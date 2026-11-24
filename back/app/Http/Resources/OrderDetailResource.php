<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Analytics\OrderCosts;
use App\Auth\PermissionCatalog;
use App\Models\Order;
use App\Models\OrderDelivery;
use App\Models\OrderEvent;
use App\Models\OrderItem;
use App\Models\OrderPayment;
use App\Models\OrderStatusLog;
use App\Models\OutboundMessage;
use App\Store\Payments\StorePayments;
use App\Support\Money;
use Illuminate\Http\Request;

/**
 * Full order for the details page: customer, answers, items, price breakdown, timeline, allowed transitions.
 *
 * @mixin Order
 */
final class OrderDetailResource extends OrderResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $money = fn (?string $value): ?float => $value === null ? null : Money::toFloat(Money::toCents($value));

        return array_merge(parent::toArray($request), [
            'customer_phone2' => $this->customer_phone2,
            'customer_email' => $this->customer_email,
            'whatsapp_opt_in' => (bool) $this->whatsapp_opt_in,
            // What the customer was told about this order, and how it ended.
            'customer_messages' => OutboundMessage::query()->where('order_id', $this->id)->orderBy('id')->get()->map(fn (OutboundMessage $m): array => [
                'id' => $m->id,
                'purpose' => $m->purpose->value,
                'channel' => $m->channel,
                'via' => $m->via,
                'status' => $m->status->value,
                'error' => $m->error_title,
                'created_at' => $m->created_at->toIso8601ZuluString(),
            ])->all(),
            'city' => $this->city,
            'address' => $this->address,
            'notes' => $this->notes,
            'internal_note' => $this->internal_note,
            'answers' => $this->answers ?? [],
            'unit_price' => $money($this->unit_price),
            'subtotal' => $money($this->subtotal),
            'offer' => $this->offer_name === null ? null : ['id' => $this->offer_id, 'name' => $this->offer_name, 'discount' => $money($this->offer_discount)],
            'code' => $this->discount_code === null ? null : ['id' => $this->discount_code_id, 'code' => $this->discount_code, 'discount' => $money($this->code_discount)],
            'shipping_fee' => $money((string) $this->shipping_fee),
            'shipping' => [
                'company' => $this->shipping_company_name === null ? null : ['id' => $this->shipping_company_id, 'name' => $this->shipping_company_name],
                'offer' => $this->shipping_offer_name,
                'discount' => $money((string) $this->shipping_discount),
                'tracking_number' => $this->tracking_number,
            ],
            // Digital lines: what was delivered (the codes sent, downloads used, the service's message).
            'deliveries' => OrderDelivery::query()->where('order_id', $this->id)->with('product.files')->orderBy('id')->get()->map(fn (OrderDelivery $d) => [
                'id' => $d->id,
                'order_item_id' => $d->order_item_id,
                'type' => $d->type->value,
                'status' => $d->status,
                'codes' => array_values($d->payload['codes'] ?? []),
                'link' => $d->payload['link'] ?? null,
                'subject' => $d->payload['subject'] ?? null,
                'message' => $d->payload['message'] ?? null,
                'limit' => $d->limit,
                'bonus' => $d->bonus,
                'usage' => (object) ($d->usage ?? []),
                'files' => ($d->product?->files ?? collect())->map(fn ($f) => ['id' => $f->id, 'name' => $f->name])->values()->all(),
                'default_subject' => $d->product?->delivery_settings['subject'] ?? null,
                'default_message' => $d->product?->delivery_settings['message'] ?? null,
                'delivered_at' => $d->delivered_at?->toIso8601ZuluString(),
                'emailed_at' => $d->emailed_at?->toIso8601ZuluString(),
            ])->values()->all(),
            // Prepaid orders: the method chosen, the customer's receipts and where he pays.
            'payment' => $this->isPrepaid() ? [
                'method_name' => $this->payment_method_name,
                'status' => $this->payment_status?->value,
                'paid_at' => $this->paid_at?->toIso8601ZuluString(),
                'pay_url' => StorePayments::payUrl($this->resource),
                'receipts' => $this->payments()->with('reviewer:id,name')->get()->map(fn (OrderPayment $p) => [
                    'id' => $p->id,
                    'method_name' => $p->method_name,
                    'amount' => Money::toFloat(Money::toCents((string) $p->amount)),
                    'sender_ref' => $p->sender_ref,
                    'status' => $p->status,
                    'reject_reason' => $p->reject_reason,
                    'is_pdf' => $p->receipt_mime === 'application/pdf',
                    'reviewer' => $p->reviewer?->name,
                    'reviewed_at' => $p->reviewed_at?->toIso8601ZuluString(),
                    'created_at' => $p->created_at->toIso8601ZuluString(),
                ])->values()->all(),
            ] : null,
            'shipment' => $this->whenLoaded('shipment', fn () => $this->shipment === null ? null : ShipmentResource::make($this->shipment)->resolve()),
            // What it cost and earns (only for whoever sees «الأرباح»).
            'profit' => $this->when(PermissionCatalog::allows($request->user(), 'profit.view'), fn () => $this->profitView()),
            'items' => $this->items->map(fn (OrderItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'is_upsell' => $item->upsell_id !== null,
                'is_gift' => (bool) $item->is_gift,
                'delivery_type' => $item->delivery_type,
                'unit_price' => $money($item->unit_price),
                'quantity' => $item->quantity,
                'options' => $item->options ?? [],
                'offer_name' => $item->offer_name,
                'offer_discount' => $money((string) ($item->offer_discount ?? '0')),
                'line_total' => $money($item->line_total),
            ])->values()->all(),
            'logs' => $this->logs->map(fn (OrderStatusLog $log) => [
                'id' => $log->id,
                'from_status' => $log->from_status?->value,
                'to_status' => $log->to_status->value,
                'to_label' => $log->to_status->label(),
                'note' => $log->note,
                'user' => $log->user === null ? null : ['id' => $log->user->id, 'name' => $log->user->name],
                'created_at' => $log->created_at->toIso8601ZuluString(),
            ])->values()->all(),
            'events' => $this->relationLoaded('events') ? $this->events->map(fn (OrderEvent $event) => [
                'id' => $event->id,
                'type' => $event->type->value,
                'label' => $event->type->label(),
                'note' => $event->note,
                'follow_up_at' => $event->follow_up_at?->toIso8601ZuluString(),
                'user' => $event->user === null ? null : ['id' => $event->user->id, 'name' => $event->user->name],
                'created_at' => $event->created_at->toIso8601ZuluString(),
            ])->values()->all() : [],
            'allowed_transitions' => array_map(fn ($s) => ['status' => $s->value, 'label' => $s->label()], $this->status->allowedTransitions()),
            'can_edit_customer' => $this->status->allowsCustomerEdits(),
            'ip_address' => $this->ip_address,
            'user_agent' => $this->user_agent,
            'utm' => $this->utm,
        ]);
    }

    /** @return array<string, mixed> */
    private function profitView(): array
    {
        $p = app(OrderCosts::class)->profit($this->resource);
        $out = ['cost_known' => $p['cost_known'], 'loss' => $p['loss'] > 0];
        foreach (['revenue', 'product_cost', 'shipping_cost', 'cod_fee', 'packaging', 'profit'] as $key) {
            $out[$key] = Money::toFloat($p[$key]);
        }

        return $out;
    }
}
