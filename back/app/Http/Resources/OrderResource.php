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
            'customer_name' => $this->customer_name,
            'customer_phone' => $this->customer_phone,
            'governorate' => $this->governorate,
            'product' => $this->whenLoaded('product', fn () => $this->product === null ? null : ['id' => $this->product->id, 'name' => $this->product->name]),
            'page' => $this->whenLoaded('page', fn () => $this->page === null ? null : ['id' => $this->page->id, 'title' => $this->page->title, 'slug' => $this->page->slug]),
            'quantity' => $this->quantity,
            'total' => Money::toFloat(Money::toCents($this->total)),
            'currency' => $this->currency,
            'is_duplicate_suspect' => $this->is_duplicate_suspect,
            'created_at' => $this->created_at->toIso8601ZuluString(),
            'status_changed_at' => $this->status_changed_at?->toIso8601ZuluString(),
        ];
    }
}
