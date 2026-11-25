<?php

declare(strict_types=1);

namespace App\Orders;

use App\Enums\OrderPaymentState;
use App\Enums\OrderRefundState;
use App\Enums\OrderStatus;
use App\Enums\RefundMethod;
use App\Enums\RefundStatus;
use App\Enums\WebhookEvent;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderPayment;
use App\Models\OrderRefund;
use App\Models\User;
use App\Notifications\CustomerNotices;
use App\Services\Webhooks\WebhookDispatcher;
use App\Store\Digital\DigitalDeliveries;
use App\Store\Payments\OnlineStorePayments;
use App\Store\Payments\StorePayments;
use App\Store\Stock;
use App\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Refunds («المرتجعات والمبالغ المسترجعة», docs/plans/merchant-essentials.md, stage 5), inside the store's tenant.
 * Money the store already has (a paid prepaid order, or a cash-on-delivery order once delivered) goes back to the
 * customer: asked first («مطلوب»), then done with its reference / proof (the customer is told, stock and digital
 * lines follow, the order's refunded total goes up) or called off. Never more than was collected minus the refunds
 * asked or done. The platform only records it: the merchant sends the money himself.
 */
final class Refunds
{
    public const DISK = 'local';

    public function __construct(
        private readonly Stock $stock,
        private readonly DigitalDeliveries $deliveries,
        private readonly CustomerNotices $customerNotices,
        private readonly WebhookDispatcher $webhooks,
        private readonly OnlineStorePayments $online,
    ) {}

    /** What the store collected for this order (cents): a paid prepaid order, or cash once delivered. */
    public function collected(Order $order): int
    {
        if ($order->isPrepaid()) {
            return $order->payment_status === OrderPaymentState::Paid ? $order->totalCents() : 0;
        }
        if ($order->status === OrderStatus::Delivered) {
            return $order->totalCents();
        }
        // Returned / damaged after it was delivered: the cash was collected first.
        $afterDelivery = in_array($order->status, [OrderStatus::Returned, OrderStatus::Damaged], true)
            && $order->logs()->where('to_status', OrderStatus::Delivered->value)->exists();

        return $afterDelivery ? $order->totalCents() : 0;
    }

    /** What can still be asked (cents): collected minus the refunds asked or done. */
    public function refundable(Order $order): int
    {
        return max(0, $this->collected($order) - $this->held($order));
    }

    /** Units of each line not yet in a refund asked or done. @return array<int, int> item id => units */
    public function itemsLeft(Order $order): array
    {
        $order->loadMissing('items');
        $used = [];
        foreach ($this->open($order)->get(['items']) as $refund) {
            foreach ($refund->quantities() as $itemId => $qty) {
                $used[$itemId] = ($used[$itemId] ?? 0) + $qty;
            }
        }

        return $order->items->mapWithKeys(fn (OrderItem $i) => [$i->id => max(0, $i->quantity - ($used[$i->id] ?? 0))])->all();
    }

    /**
     * «رد مبلغ»: a refund asked for the order; done right away when the merchant already sent it.
     *
     * @param  array{amount: int, items?: list<array{order_item_id: int, quantity: int}>, reason?: string|null, method: RefundMethod, destination?: string|null, restock?: bool, revoke_digital?: bool, done?: bool, reference?: string|null}  $data  amount in cents
     *
     * @throws ValidationException on amount / items
     */
    public function request(Order $order, array $data, User $by, ?UploadedFile $proof = null): OrderRefund
    {
        $refund = DB::transaction(function () use ($order, $data, $by): OrderRefund {
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $collected = $this->collected($locked);
            if ($collected === 0) {
                throw new ApiException(422, 'nothing_collected', __('refunds.nothing_collected'));
            }
            $left = max(0, $collected - $this->held($locked));
            if ($data['amount'] < 1 || $data['amount'] > $left) {
                throw ValidationException::withMessages(['amount' => [__('refunds.amount_max', ['max' => self::plain($left)])]]);
            }
            $items = $this->checkItems($locked, $data['items'] ?? []);
            if ($data['method'] === RefundMethod::Gateway && $this->online->paidVia($locked) === null) {
                throw ValidationException::withMessages(['method' => [__('payments.gateways.not_paid_online')]]);
            }

            return $locked->refunds()->create([
                'amount' => Money::toDecimal($data['amount']),
                'items' => $items === [] ? null : $items,
                'reason' => self::clean($data['reason'] ?? null, 300),
                'method' => $data['method'],
                'destination' => self::clean($data['destination'] ?? null, 120) ?? $this->defaultDestination($locked),
                'status' => RefundStatus::Pending,
                // Stock and digital lines follow only lines that were chosen.
                'restock' => $items !== [] && ($data['restock'] ?? false) === true,
                'revoke_digital' => $items !== [] && ($data['revoke_digital'] ?? false) === true,
                'created_by' => $by->id,
            ]);
        });

        return ($data['done'] ?? false) === true ? $this->complete($refund, $data['reference'] ?? null, $proof, $by) : $refund;
    }

    /** «اترجّع»: the money went back (reference / proof optional). The customer is told; stock / downloads follow. */
    public function complete(OrderRefund $refund, ?string $reference, ?UploadedFile $proof, User $by): OrderRefund
    {
        if ($refund->method === RefundMethod::Gateway) {
            $done = $this->viaGateway($refund, $by);
        } else {
            $path = $proof === null ? null : $proof->storeAs('order-refunds/'.$refund->tenant_id.'/'.$refund->order_id, Str::lower(Str::random(32)).'.'.StorePayments::RECEIPT_MIMES[(string) $proof->getMimeType()], self::DISK);
            try {
                $done = $this->markDone($refund, $reference, $proof, $path, $by);
            } catch (Throwable $e) {
                if ($path !== null) {
                    Storage::disk(self::DISK)->delete($path);
                }
                throw $e;
            }
        }

        $order = Order::query()->with('items')->findOrFail($done->order_id);
        $this->customerNotices->refunded($order, $done);
        $this->webhooks->order(WebhookEvent::OrderRefunded, $order, ['refund' => $this->hookView($done, $order)]);

        return $done;
    }

    /**
     * The money goes back through the store's gateway, then the refund is done with the gateway's reference. One at a
     * time per refund (a double press never refunds twice); the gateway's refusal leaves it asked.
     */
    private function viaGateway(OrderRefund $refund, User $by): OrderRefund
    {
        $lock = Cache::lock('order-refund:'.$refund->id, 60);
        if (! $lock->get()) {
            throw new ApiException(409, 'refund_in_progress', __('refunds.in_progress'));
        }
        try {
            $fresh = OrderRefund::query()->findOrFail($refund->id);
            if ($fresh->status !== RefundStatus::Pending) {
                throw new ApiException(409, 'refund_not_pending', __('refunds.not_pending'));
            }
            $order = Order::query()->findOrFail($fresh->order_id);
            $sent = $this->online->refund($order, Money::toCents((string) $fresh->amount), $fresh->reason);

            return $this->markDone($fresh, $sent->reference, null, null, $by);
        } finally {
            $lock->release();
        }
    }

    private function markDone(OrderRefund $refund, ?string $reference, ?UploadedFile $proof, ?string $path, User $by): OrderRefund
    {
        return DB::transaction(function () use ($refund, $reference, $proof, $path, $by): OrderRefund {
            $order = Order::query()->whereKey($refund->order_id)->lockForUpdate()->firstOrFail();
            $locked = OrderRefund::query()->whereKey($refund->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== RefundStatus::Pending) {
                throw new ApiException(409, 'refund_not_pending', __('refunds.not_pending'));
            }
            $locked->forceFill([
                'status' => RefundStatus::Done,
                'reference' => self::clean($reference, 120) ?? $locked->reference,
                'proof_path' => $path ?? $locked->proof_path,
                'proof_mime' => $path === null ? $locked->proof_mime : (string) $proof?->getMimeType(),
                'done_by' => $by->id,
                'done_at' => now(),
            ])->save();

            $refunded = Money::toCents((string) $order->refunded_total) + Money::toCents((string) $locked->amount);
            $order->forceFill([
                'refunded_total' => Money::toDecimal($refunded),
                'refund_state' => $refunded >= $this->collected($order) ? OrderRefundState::Full : OrderRefundState::Partial,
            ])->save();

            $quantities = $locked->quantities();
            if ($locked->restock && $quantities !== []) {
                $this->stock->restockItems($order, $quantities);
                $locked->forceFill(['restocked_at' => now()])->save();
            }
            if ($locked->revoke_digital && $quantities !== []) {
                $this->deliveries->revoke($order, array_keys($quantities));
            }

            return $locked;
        });
    }

    /** A refund asked by mistake is called off (only while still asked). */
    public function cancel(OrderRefund $refund, User $by): OrderRefund
    {
        return DB::transaction(function () use ($refund, $by): OrderRefund {
            $locked = OrderRefund::query()->whereKey($refund->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== RefundStatus::Pending) {
                throw new ApiException(409, 'refund_not_pending', __('refunds.not_pending'));
            }
            $locked->forceFill(['status' => RefundStatus::Cancelled, 'cancelled_by' => $by->id, 'cancelled_at' => now()])->save();

            return $locked;
        });
    }

    public function proofPath(OrderRefund $refund): ?string
    {
        return $refund->proof_path === null ? null : Storage::disk(self::DISK)->path($refund->proof_path);
    }

    /** The order page's refunds box. @return array<string, mixed> */
    public function orderView(Order $order): array
    {
        $collected = $this->collected($order);
        $refunds = $order->refunds()->with(['creator:id,name', 'doer:id,name'])->get();

        return [
            'collected' => Money::toFloat($collected),
            'refundable' => Money::toFloat(max(0, $collected - $this->held($order))),
            'refunded' => Money::toFloat(Money::toCents((string) $order->refunded_total)),
            'state' => $order->refund_state?->value,
            'method_name' => $this->originalMethod($order),
            // Paid online with the store's gateway: the money can go back through it by itself.
            'gateway' => $this->online->paidVia($order),
            'default_destination' => $this->defaultDestination($order),
            'items_left' => (object) $this->itemsLeft($order),
            'list' => $refunds->map(fn (OrderRefund $r) => $this->view($r, $order))->values()->all(),
        ];
    }

    /** One refund for the screens. @return array<string, mixed> */
    public function view(OrderRefund $refund, Order $order): array
    {
        $order->loadMissing('items');
        $names = $order->items->pluck('product_name', 'id');

        return [
            'id' => $refund->id,
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'customer_name' => $order->customer_name,
            'amount' => Money::toFloat(Money::toCents((string) $refund->amount)),
            'items' => array_map(fn (array $l) => ['order_item_id' => (int) $l['order_item_id'], 'product_name' => $names[(int) $l['order_item_id']] ?? null, 'quantity' => (int) $l['quantity']], $refund->items ?? []),
            'reason' => $refund->reason,
            'method' => $refund->method->value,
            'method_label' => $this->methodLabel($refund, $order),
            'destination' => $refund->destination,
            'reference' => $refund->reference,
            'has_proof' => $refund->proof_path !== null,
            'proof_is_pdf' => $refund->proof_mime === 'application/pdf',
            'status' => $refund->status->value,
            'restock' => $refund->restock,
            'restocked' => $refund->restocked_at !== null,
            'revoke_digital' => $refund->revoke_digital,
            'created_by' => $refund->relationLoaded('creator') ? $refund->creator?->name : null,
            'done_by' => $refund->relationLoaded('doer') ? $refund->doer?->name : null,
            'done_at' => $refund->done_at?->toIso8601ZuluString(),
            'cancelled_at' => $refund->cancelled_at?->toIso8601ZuluString(),
            'created_at' => $refund->created_at->toIso8601ZuluString(),
        ];
    }

    /**
     * What the customer sees (pay / tracking page): refunds asked or done, never the merchant's notes. Loads the
     * relation inside the tenant (the tracking page eager-loads it).
     *
     * @return list<array<string, mixed>>
     */
    public function customerView(Order $order): array
    {
        $order->loadMissing('refunds');

        return $order->refunds->filter(fn (OrderRefund $r) => $r->status !== RefundStatus::Cancelled)
            ->map(fn (OrderRefund $r) => [
                'amount' => Money::toFloat(Money::toCents((string) $r->amount)),
                'status' => $r->status->value,
                'method' => $this->methodLabel($r, $order),
                'done_at' => $r->done_at?->toIso8601ZuluString(),
            ])->values()->all();
    }

    /** The refund in the webhook (order.refunded). @return array<string, mixed> */
    public function hookView(OrderRefund $refund, Order $order): array
    {
        return [
            'amount' => Money::toFloat(Money::toCents((string) $refund->amount)),
            'method' => $refund->method->value,
            'method_label' => $this->methodLabel($refund, $order),
            'reason' => $refund->reason,
            'reference' => $refund->reference,
            'items' => array_map(fn (array $l) => ['product' => $order->items->firstWhere('id', (int) $l['order_item_id'])?->product_name, 'quantity' => (int) $l['quantity']], $refund->items ?? []),
            'done_at' => $refund->done_at?->toIso8601ZuluString(),
            'refunded_total' => Money::toFloat(Money::toCents((string) $order->refunded_total)),
            'refund_state' => $order->refund_state?->value,
        ];
    }

    public function methodLabel(OrderRefund $refund, Order $order): string
    {
        return match ($refund->method) {
            RefundMethod::Original => $this->originalMethod($order),
            RefundMethod::Gateway => (string) __('refunds.via_gateway', ['gateway' => $this->online->paidVia($order)['label'] ?? '—']),
            default => $refund->method->label(),
        };
    }

    private function originalMethod(Order $order): string
    {
        return $order->isPrepaid() ? ($order->payment_method_name ?: RefundMethod::Original->label()) : (string) __('refunds.cash_on_delivery');
    }

    /** Where the money goes by default: the number the customer paid from, else his phone. */
    private function defaultDestination(Order $order): ?string
    {
        $from = $order->isPrepaid() ? $order->payments()->where('status', OrderPayment::APPROVED)->latest('id')->value('sender_ref') : null;

        return is_string($from) && $from !== '' ? $from : $order->customer_phone;
    }

    /** Refunds asked or done (cents). */
    private function held(Order $order): int
    {
        return Money::toCents((string) $this->open($order)->sum('amount'));
    }

    /** @return Builder<OrderRefund> */
    private function open(Order $order): Builder
    {
        return OrderRefund::query()->where('order_id', $order->id)->whereIn('status', [RefundStatus::Pending->value, RefundStatus::Done->value]);
    }

    /**
     * The chosen lines: the order's own, each at most what is left of it, merged per line.
     *
     * @param  list<array{order_item_id: int, quantity: int}>  $lines
     * @return list<array{order_item_id: int, quantity: int}>
     */
    private function checkItems(Order $order, array $lines): array
    {
        $wanted = [];
        foreach ($lines as $line) {
            $wanted[(int) $line['order_item_id']] = ($wanted[(int) $line['order_item_id']] ?? 0) + (int) $line['quantity'];
        }
        $left = $this->itemsLeft($order);
        $out = [];
        foreach ($wanted as $itemId => $qty) {
            if (! array_key_exists($itemId, $left)) {
                throw ValidationException::withMessages(['items' => [__('refunds.item_unknown')]]);
            }
            if ($qty < 1 || $qty > $left[$itemId]) {
                throw ValidationException::withMessages(['items' => [__('refunds.item_max', ['max' => $left[$itemId]])]]);
            }
            $out[] = ['order_item_id' => $itemId, 'quantity' => $qty];
        }

        return $out;
    }

    private static function clean(?string $value, int $max): ?string
    {
        $value = $value === null ? '' : trim(strip_tags($value));

        return $value === '' ? null : mb_substr($value, 0, $max);
    }

    private static function plain(int $cents): string
    {
        return number_format($cents / 100, $cents % 100 === 0 ? 0 : 2);
    }
}
