<?php

declare(strict_types=1);

namespace App\Store\Payments;

use App\Actions\Orders\ChangeOrderStatus;
use App\Enums\OrderPaymentState;
use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\StorePaymentMethod;
use App\Models\StorePaymentSetting;
use App\Models\User;
use App\Notifications\CustomerNotices;
use App\Notifications\StoreNotices;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Paying a store before delivery (inside the store's tenant): the checkout choice (cash on delivery or one of the
 * store's own methods), the customer's receipt, the merchant's answer, and cancelling orders left unpaid.
 * The money goes from the customer to the merchant directly; the platform only shows the way and the receipt.
 */
final class StorePayments
{
    public const DISK = 'local';

    public const RECEIPT_MAX_KB = 10240;

    public const RECEIPT_MIMES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic', 'image/heif' => 'heif', 'application/pdf' => 'pdf'];

    public function __construct(
        private readonly ChangeOrderStatus $status,
        private readonly CustomerNotices $customerNotices,
        private readonly StoreNotices $notices,
    ) {}

    /** Digital products can be sold (they need a prepaid method). */
    public function prepaidReady(): bool
    {
        return StorePaymentMethod::query()->where('is_active', true)->exists();
    }

    /** What a checkout offers: cash on delivery (when on) and the active methods. @return array{cod: bool, methods: list<array<string, mixed>>} */
    public function options(): array
    {
        $methods = StorePaymentMethod::query()->where('is_active', true)->orderBy('position')->orderBy('id')->get();

        return [
            // With no other way left, cash on delivery always works (an order is never impossible).
            'cod' => StorePaymentSetting::current()->cod_enabled || $methods->isEmpty(),
            'methods' => $methods->map(fn (StorePaymentMethod $m) => $m->publicView())->values()->all(),
        ];
    }

    /**
     * The customer's choice at checkout: "cod", a method id, or nothing (cash on delivery when it is on). An order with
     * digital products is always prepaid.
     *
     * @throws ValidationException on payment_method
     */
    public function choose(mixed $raw, bool $prepaidOnly = false): ?StorePaymentMethod
    {
        $raw = is_scalar($raw) ? trim((string) $raw) : '';
        $options = $this->options();
        if ($prepaidOnly && ($raw === '' || $raw === Order::COD)) {
            throw ValidationException::withMessages(['payment_method' => [__($options['methods'] === [] ? 'digital.no_prepaid' : 'digital.prepaid_only')]]);
        }
        if ($raw === '' || $raw === Order::COD) {
            if (! $options['cod']) {
                throw ValidationException::withMessages(['payment_method' => [__('payments.choose')]]);
            }

            return null;
        }
        $method = ctype_digit($raw) ? StorePaymentMethod::query()->where('is_active', true)->find((int) $raw) : null;

        return $method ?? throw ValidationException::withMessages(['payment_method' => [__('payments.unavailable')]]);
    }

    /** Order columns for the choice (a prepaid order starts waiting for its payment). @return array<string, mixed> */
    public static function orderFields(?StorePaymentMethod $method): array
    {
        return $method === null
            ? ['payment_method' => Order::COD, 'status' => OrderStatus::New]
            : ['payment_method' => Order::PREPAID, 'store_payment_method_id' => $method->id, 'payment_method_name' => $method->name, 'payment_status' => OrderPaymentState::Unpaid, 'status' => OrderStatus::AwaitingPayment];
    }

    /** Where the customer pays and sends the receipt: https://{store's primary host}/pay/{token}. */
    public static function payUrl(Order $order): ?string
    {
        $host = app(PublicSite::class)->primaryHost($order->tenant_id);

        return $host === null || $order->track_token === null ? null : rtrim(PublicSite::url($host), '/').'/pay/'.$order->track_token;
    }

    /** The problem with a receipt file (translated), or null. */
    public static function receiptProblem(UploadedFile $file): ?string
    {
        if (! isset(self::RECEIPT_MIMES[(string) $file->getMimeType()])) {
            return (string) __('payments.receipt_type');
        }

        return (int) ceil(((int) $file->getSize()) / 1024) > self::RECEIPT_MAX_KB ? (string) __('payments.receipt_size', ['max' => intdiv(self::RECEIPT_MAX_KB, 1024)]) : null;
    }

    /** The customer sends a receipt (the order waits for payment, nothing else waits for review). */
    public function submit(Order $order, StorePaymentMethod $method, ?string $senderRef, UploadedFile $file): OrderPayment
    {
        $payment = DB::transaction(function () use ($order, $method, $senderRef, $file): OrderPayment {
            $locked = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== OrderStatus::AwaitingPayment) {
                throw new ApiException(409, 'not_awaiting_payment', __('payments.not_awaiting'));
            }
            if ($locked->payments()->where('status', OrderPayment::PENDING)->exists()) {
                throw new ApiException(409, 'receipt_pending', __('payments.receipt_pending'));
            }
            $ext = self::RECEIPT_MIMES[(string) $file->getMimeType()];
            $path = $file->storeAs('order-receipts/'.$locked->tenant_id.'/'.$locked->id, Str::lower(Str::random(32)).'.'.$ext, self::DISK);
            $payment = $locked->payments()->create([
                'store_payment_method_id' => $method->id,
                'method_name' => $method->name,
                'amount' => $locked->total,
                'sender_ref' => $senderRef === null ? null : (mb_substr(trim(strip_tags($senderRef)), 0, 80) ?: null),
                'receipt_path' => (string) $path,
                'receipt_mime' => (string) $file->getMimeType(),
                'status' => OrderPayment::PENDING,
            ]);
            $locked->forceFill(['payment_status' => OrderPaymentState::Review, 'store_payment_method_id' => $method->id, 'payment_method_name' => $method->name])->save();

            return $payment;
        });

        $this->notices->receiptSubmitted($order->refresh(), $payment);

        return $payment;
    }

    /** «الفلوس وصلت»: the receipt is accepted and the order confirmed (its deliveries / shipping follow). */
    public function approve(OrderPayment $payment, User $by): Order
    {
        $order = DB::transaction(function () use ($payment, $by): Order {
            $locked = OrderPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== OrderPayment::PENDING) {
                throw new ApiException(409, 'receipt_reviewed', __('payments.already_reviewed'));
            }
            $locked->forceFill(['status' => OrderPayment::APPROVED, 'reviewed_by' => $by->id, 'reviewed_at' => now()])->save();

            return Order::query()->findOrFail($locked->order_id);
        });

        // Confirming marks it paid (ChangeOrderStatus) and tells the customer.
        return $order->status === OrderStatus::AwaitingPayment
            ? $this->status->handle($order, OrderStatus::Confirmed, __('payments.confirmed_note', ['method' => $payment->method_name]), $by->id)
            : $this->markPaid($order);
    }

    /** The receipt is refused with a reason; the customer is told and can send another one. */
    public function reject(OrderPayment $payment, string $reason, User $by): Order
    {
        $order = DB::transaction(function () use ($payment, $reason, $by): Order {
            $locked = OrderPayment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== OrderPayment::PENDING) {
                throw new ApiException(409, 'receipt_reviewed', __('payments.already_reviewed'));
            }
            $locked->forceFill(['status' => OrderPayment::REJECTED, 'reject_reason' => mb_substr(trim(strip_tags($reason)), 0, 300), 'reviewed_by' => $by->id, 'reviewed_at' => now()])->save();
            $order = Order::query()->whereKey($locked->order_id)->lockForUpdate()->firstOrFail();
            if ($order->payment_status === OrderPaymentState::Review) {
                $order->forceFill(['payment_status' => OrderPaymentState::Unpaid])->save();
            }

            return $order;
        });
        $this->customerNotices->paymentRejected($order);

        return $order;
    }

    /** The payment is in (a confirmed prepaid order, or approved after it was already confirmed by hand). */
    public function markPaid(Order $order): Order
    {
        if ($order->isPrepaid() && $order->payment_status !== OrderPaymentState::Paid) {
            $order->forceFill(['payment_status' => OrderPaymentState::Paid, 'paid_at' => now()])->save();
        }

        return $order;
    }

    public function receiptPath(OrderPayment $payment): string
    {
        return Storage::disk(self::DISK)->path($payment->receipt_path);
    }

    /**
     * Prepaid orders still unpaid after the store's days (no receipt waiting) are cancelled, their stock back.
     * Returns how many.
     */
    public function cancelUnpaid(): int
    {
        // Audited bypass: the tenants with orders waiting for payment; each one then runs inside its own tenant.
        $tenants = Tenancy::withoutTenant(fn () => Order::query()->where('status', OrderStatus::AwaitingPayment)->distinct()->pluck('tenant_id')->all());
        $count = 0;
        foreach ($tenants as $tenantId) {
            $count += Tenancy::runAs((int) $tenantId, function (): int {
                $days = max(1, StorePaymentSetting::current()->cancel_after_days);
                $done = 0;
                Order::query()->where('status', OrderStatus::AwaitingPayment)->where('created_at', '<', now()->subDays($days))
                    ->whereDoesntHave('payments', fn ($q) => $q->where('status', OrderPayment::PENDING))
                    ->each(function (Order $order) use (&$done): void {
                        $this->status->handle($order, OrderStatus::Cancelled, (string) __('payments.auto_cancel_note'), null);
                        $done++;
                    });

                return $done;
            });
        }

        return $count;
    }
}
