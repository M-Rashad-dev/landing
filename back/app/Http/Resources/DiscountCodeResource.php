<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Enums\DiscountType;
use App\Models\DiscountCode;
use App\Models\Product;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DiscountCode */
final class DiscountCodeResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $money = fn (?int $cents) => $cents === null ? null : Money::toFloat($cents);

        return [
            'id' => $this->id,
            'code' => $this->code,
            'type' => $this->type->value,
            'value' => $this->type === DiscountType::Percentage ? intdiv($this->valueCents(), 100) : Money::toFloat($this->valueCents()),
            'max_discount' => $money($this->maxDiscountCents()),
            'min_order_total' => $money($this->minOrderTotalCents()),
            'starts_at' => $this->starts_at?->toIso8601ZuluString(),
            'ends_at' => $this->ends_at?->toIso8601ZuluString(),
            'usage_limit' => $this->usage_limit,
            'usage_limit_per_phone' => $this->usage_limit_per_phone,
            'used_count' => $this->used_count,
            'remaining' => $this->remaining(),
            'stackable_with_offers' => $this->stackable_with_offers,
            'is_active' => $this->is_active,
            'status' => $this->statusAt(now())->value,
            'products' => $this->whenLoaded('products', fn () => $this->products->map(fn (Product $product) => ['id' => $product->id, 'name' => $product->name])->values()->all()),
            'product_ids' => $this->whenLoaded('products', fn () => $this->products->pluck('id')->all()),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
