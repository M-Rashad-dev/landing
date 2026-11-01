<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Enums\OfferType;
use App\Models\Offer;
use App\Models\Product;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Offer */
final class OfferResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type->value,
            'value' => match ($this->type) {
                OfferType::Percentage => intdiv($this->valueCents(), 100),
                OfferType::Fixed => Money::toFloat($this->valueCents()),
                default => null,
            },
            'min_quantity' => $this->min_quantity,
            'free_quantity' => $this->free_quantity,
            'gift_product_id' => $this->gift_product_id,
            'gift_product' => $this->whenLoaded('giftProduct', fn () => $this->giftProduct ? ['id' => $this->giftProduct->id, 'name' => $this->giftProduct->name, 'price' => Money::toFloat($this->giftProduct->priceCents())] : null),
            'bundle_quantity' => $this->bundle_quantity,
            'bundle_price' => $this->bundle_price === null ? null : Money::toFloat($this->bundlePriceCents()),
            'starts_at' => $this->starts_at?->toIso8601ZuluString(),
            'ends_at' => $this->ends_at?->toIso8601ZuluString(),
            'is_active' => $this->is_active,
            'status' => $this->statusAt(now())->value,
            'badge_text' => $this->badge_text,
            'priority' => $this->priority,
            'products' => $this->whenLoaded('products', fn () => $this->products->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'price' => Money::toFloat($product->priceCents()),
            ])->values()->all()),
            'product_ids' => $this->whenLoaded('products', fn () => $this->products->pluck('id')->all()),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
