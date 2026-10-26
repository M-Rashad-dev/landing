<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Media;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Visitor-facing product: no internal fields (sku, timestamps, tenant), image
 * URLs only, and only active option values (options left without values are hidden).
 *
 * @mixin Product
 */
final class PublicProductResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $compare = $this->compareAtCents();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => Money::toFloat($this->priceCents()),
            'compare_at_price' => $compare === null ? null : Money::toFloat($compare),
            'available' => $this->is_active,
            'images' => $this->media->map(fn (Media $media) => [
                'id' => $media->id,
                'alt' => $media->alt,
                'width' => $media->width,
                'height' => $media->height,
                'urls' => $media->urls(),
            ])->values()->all(),
            'options' => $this->options
                ->map(fn (ProductOption $option) => [
                    'id' => $option->id,
                    'name' => $option->name,
                    'display_type' => $option->display_type->value,
                    'is_required' => $option->is_required,
                    'values' => $option->values
                        ->filter(fn (ProductOptionValue $value) => $value->is_active)
                        ->map(fn (ProductOptionValue $value) => [
                            'id' => $value->id,
                            'label' => $value->label,
                            'color_hex' => $value->color_hex,
                            'price_delta' => Money::toFloat($value->priceDeltaCents()),
                        ])->values()->all(),
                ])
                ->filter(fn (array $option) => $option['values'] !== [])
                ->values()
                ->all(),
        ];
    }
}
