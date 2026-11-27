<?php

declare(strict_types=1);

namespace App\Actions\Products;

use App\Billing\Entitlements;
use App\Enums\PlanLimit;
use App\Models\Product;
use App\Models\ProductInput;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Store\Specs\ProductSpecs;
use App\Support\Slugs;
use Illuminate\Support\Facades\DB;

/** Copies a product with its options, values, images and spec tables; the copy starts inactive. */
final class DuplicateProduct
{
    public function handle(Product $source): Product
    {
        app(Entitlements::class)->ensureCanAdd(PlanLimit::Products);

        return DB::transaction(function () use ($source): Product {
            $source->loadMissing(['options.values', 'media']);
            $suffix = __('products.copy_suffix');

            $copy = $source->replicate(['created_at', 'updated_at', 'deleted_at']);
            $copy->name = mb_substr($source->name, 0, 150 - mb_strlen($suffix)).$suffix;
            $copy->is_active = false;
            // A copy starts with its own link and no stock (the merchant counts it again).
            $copy->slug = Slugs::unique(Product::query()->withTrashed(), $copy->name);
            $copy->stock = $copy->stock_mode === Product::STOCK_PRODUCT ? 0 : null;
            $copy->save();
            $copy->categories()->sync($source->categories()->pluck('categories.id')->all());

            foreach ($source->options as $option) {
                $newOption = ProductOption::create([
                    'product_id' => $copy->id,
                    'name' => $option->name,
                    'display_type' => $option->display_type,
                    'is_required' => $option->is_required,
                    'position' => $option->position,
                ]);

                foreach ($option->values as $value) {
                    ProductOptionValue::create([
                        'option_id' => $newOption->id,
                        'label' => $value->label,
                        'color_hex' => $value->color_hex,
                        'price_delta' => $value->price_delta,
                        'is_active' => $value->is_active,
                        'position' => $value->position,
                    ]);
                }
            }

            foreach ($source->inputs as $input) {
                ProductInput::query()->create([
                    'product_id' => $copy->id,
                    'kind' => $input->kind,
                    'label' => $input->label,
                    'placeholder' => $input->placeholder,
                    'is_required' => $input->is_required,
                    'price_delta' => $input->price_delta,
                    'position' => $input->position,
                ]);
            }

            $now = now();
            $rows = $source->media->map(fn ($media) => [
                'tenant_id' => $copy->tenant_id,
                'product_id' => $copy->id,
                'media_id' => $media->id,
                'position' => (int) $media->pivot->position,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            if ($rows !== []) {
                DB::table('product_media')->insert($rows);
            }

            app(ProductSpecs::class)->copy($source, $copy);

            return $copy;
        });
    }
}
