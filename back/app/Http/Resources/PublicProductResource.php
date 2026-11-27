<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Media;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Store\Payments\StorePayments;
use App\Store\Specs\ProductSpecs;
use App\Store\Stock;
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
        // A codes product shows its codes left as stock (per option combination when it has options).
        $codes = $this->deliversCodes() ? app(Stock::class)->codeStock($this->resource) : null;
        $variantCodes = $codes !== null && $this->options->contains(fn (ProductOption $o) => $o->is_required);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'price' => Money::toFloat($this->priceCents()),
            'compare_at_price' => $compare === null ? null : Money::toFloat($compare),
            // A digital product needs a prepaid way to pay.
            'available' => $this->is_active && $this->inStock() && (! $this->isDigital() || app(StorePayments::class)->prepaidReady()),
            'kind' => $this->kind,
            'delivery_type' => $this->delivery_type?->value,
            'slug' => $this->slug,
            'short_description' => $this->short_description,
            // Stock: unlimited → null; product → units left; variant → units per combination key.
            'stock_mode' => $codes !== null ? ($variantCodes ? Product::STOCK_VARIANT : Product::STOCK_PRODUCT) : $this->stock_mode,
            'stock' => $codes !== null ? ($variantCodes ? null : (int) ($codes[''] ?? 0)) : ($this->stock_mode === Product::STOCK_PRODUCT ? max(0, (int) $this->stock) : null),
            'variant_stock' => $codes !== null ? ($variantCodes ? (object) $codes : null) : ($this->stock_mode === Product::STOCK_VARIANT ? app(Stock::class)->variantStock($this->resource) : null),
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
            // «حسب الطلب»: what the customer types or uploads when buying.
            'inputs' => $this->inputs->map(fn (ProductInput $input) => ProductResource::input($input))->values()->all(),
            'video_url' => $this->video_url,
            // «المواصفات»: tables with their filled rows only (empty → []).
            'specs' => app(ProductSpecs::class)->forPublic($this->resource),
        ];
    }
}
