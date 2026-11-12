<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\ShippingOffer;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ShippingOffer */
final class ShippingOfferResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'benefit' => $this->benefit->value,
            'value' => $this->value === null ? null : Money::toFloat($this->valueCents()),
            'min_quantity' => $this->min_quantity,
            'min_total' => $this->min_total === null ? null : Money::toFloat((int) $this->minTotalCents()),
            'applies_to' => $this->applies_to->value,
            'products' => $this->whenLoaded('products', fn () => $this->products->map(fn ($p) => ['id' => $p->id, 'name' => $p->name])->values()->all()),
            'product_ids' => $this->whenLoaded('products', fn () => $this->products->pluck('id')->all()),
            'categories' => $this->whenLoaded('categories', fn () => $this->categories->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])->values()->all()),
            'category_ids' => $this->whenLoaded('categories', fn () => $this->categories->pluck('id')->all()),
            'governorates' => $this->governorates ?? [],
            'company_ids' => array_map('intval', $this->company_ids ?? []),
            'starts_at' => $this->starts_at?->toIso8601ZuluString(),
            'ends_at' => $this->ends_at?->toIso8601ZuluString(),
            'is_active' => $this->is_active,
            'status' => $this->statusAt(now())->value,
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
