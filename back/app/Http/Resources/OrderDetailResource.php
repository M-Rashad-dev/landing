<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
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
        $money = fn (string $value): float => Money::toFloat(Money::toCents($value));

        return array_merge(parent::toArray($request), [
            'customer_phone2' => $this->customer_phone2,
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
            'items' => $this->items->map(fn (OrderItem $item) => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'is_upsell' => $item->upsell_id !== null,
                'unit_price' => $money($item->unit_price),
                'quantity' => $item->quantity,
                'options' => $item->options ?? [],
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
}
