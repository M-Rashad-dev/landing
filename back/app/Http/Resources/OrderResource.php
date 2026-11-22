<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Order;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * List row of an order (dashboard).
 *
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'order_number' => $this->order_number,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            // cod | prepaid; payment_status unpaid | review | paid (null for cash on delivery).
            'payment_method' => $this->payment_method,
            'payment_status' => $this->payment_status?->value,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'governorate' => $this->governorate,
            'product' => $this->whenLoaded('product', fn () => $this->product === null ? null : ['id' => $this->product->id, 'name' => $this->product->name]),
            'page' => $this->whenLoaded('page', fn () => $this->page === null ? null : ['id' => $this->page->id, 'title' => $this->page->title, 'slug' => $this->page->slug]),
            'quantity' => $this->quantity,
            'source' => $this->source,
            'shipping_company' => $this->shipping_company_name,
            'tracking_number' => $this->tracking_number,
            'shipment' => $this->whenLoaded('shipment', fn () => $this->shipment === null ? null : ['id' => $this->shipment->id, 'state' => $this->shipment->state->value, 'state_label' => $this->shipment->state->label(), 'is_open' => $this->shipment->is_open, 'tracking_number' => $this->shipment->tracking_number]),
            // Store orders: "تيشيرت + 2 منتج تاني" in lists.
            'items_summary' => $this->whenLoaded('items', fn () => [
                'first' => $this->items->firstWhere('is_gift', false)?->product_name,
                'count' => $this->items->where('is_gift', false)->count(),
            ]),
            'total' => Money::toFloat(Money::toCents($this->total)),
            'currency' => $this->currency,
            'is_duplicate_suspect' => $this->is_duplicate_suspect,
            'created_at' => $this->created_at->toIso8601ZuluString(),
            'status_changed_at' => $this->status_changed_at?->toIso8601ZuluString(),
            'contact_attempts' => $this->contact_attempts,
            'last_contacted_at' => $this->last_contacted_at?->toIso8601ZuluString(),
            'follow_up_at' => $this->follow_up_at?->toIso8601ZuluString(),
        ];
    }
}
