<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Product */
final class ProductResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $price = $this->priceCents();
        $compare = $this->compareAtCents();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => Money::toFloat($price),
            'compare_at_price' => $compare === null ? null : Money::toFloat($compare),
            'discount_percent' => $compare !== null && $compare > $price ? (int) round(($compare - $price) * 100 / $compare) : null,
            'sku' => $this->sku,
            'is_active' => $this->is_active,
            'slug' => $this->slug,
            'short_description' => $this->short_description,
            'in_store' => $this->in_store,
            'is_featured' => $this->is_featured,
            'stock_mode' => $this->stock_mode,
            'stock' => $this->stock,
            'low_stock_threshold' => $this->low_stock_threshold,
            'seo' => $this->seo,
            'category_ids' => $this->whenLoaded('categories', fn () => $this->categories->pluck('id')->all()),
            'variants' => $this->whenLoaded('variants', fn () => $this->variants->map(fn ($v) => ['id' => $v->id, 'value_ids' => $v->valueIds(), 'stock' => $v->stock, 'sku' => $v->sku])->all()),
            'locked_by_plan' => (bool) $this->locked_by_plan,
            'main_image' => $this->whenLoaded('media', fn () => $this->media->first() ? MediaResource::make($this->media->first())->resolve($request) : null),
            'media' => $this->whenLoaded('media', fn () => MediaResource::collection($this->media)->resolve($request)),
            'media_ids' => $this->whenLoaded('media', fn () => $this->media->pluck('id')->all()),
            'options_count' => $this->whenCounted('options'),
            'options' => $this->whenLoaded('options', fn () => $this->options->map(fn (ProductOption $option) => [
                'id' => $option->id,
                'name' => $option->name,
                'display_type' => $option->display_type->value,
                'is_required' => $option->is_required,
                'values' => $option->relationLoaded('values') ? $option->values->map(fn (ProductOptionValue $value) => [
                    'id' => $value->id,
                    'label' => $value->label,
                    'color_hex' => $value->color_hex,
                    'price_delta' => Money::toFloat($value->priceDeltaCents()),
                    'is_active' => $value->is_active,
                ])->all() : [],
            ])->all()),
            'created_at' => $this->created_at?->toIso8601ZuluString(),
            'updated_at' => $this->updated_at?->toIso8601ZuluString(),
        ];
    }
}
