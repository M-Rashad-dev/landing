<?php

declare(strict_types=1);

namespace App\Actions\Products;

use App\Billing\Entitlements;
use App\Enums\PlanLimit;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\ProductVariant;
use App\Store\ProductCategories;
use App\Store\Stock;
use App\Support\Money;
use App\Support\SeoInput;
use App\Support\Slugs;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates a product with its options, values and images in one
 * transaction. Nested items are synced by id: with id → update, without → create,
 * missing from the request → delete (old orders keep their own snapshot).
 */
final class SaveProduct
{
    /**
     * @param  array<string, mixed>  $data  validated ProductRequest data
     * @param  bool  $revalidate  false when a batch (an import) refreshes the store once at the end
     */
    public function handle(array $data, ?Product $product = null, bool $revalidate = true): Product
    {
        if ($product === null) {
            app(Entitlements::class)->ensureCanAdd(PlanLimit::Products);
        }

        $product = DB::transaction(function () use ($data, $product): Product {
            $product ??= new Product;
            $product->fill([
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'price' => Money::toDecimal(Money::toCents((string) $data['price'])),
                'compare_at_price' => isset($data['compare_at_price']) ? Money::toDecimal(Money::toCents((string) $data['compare_at_price'])) : null,
                'sku' => $data['sku'] ?? null,
                'is_active' => (bool) ($data['is_active'] ?? $product->is_active ?? true),
            ]);
            $this->fillStoreFields($product, $data);
            $product->save();
            if ($product->slug === null) {
                $product->forceFill(['slug' => Slugs::unique(Product::query()->withTrashed(), $product->name, $product->id)])->save();
            }

            if (array_key_exists('category_ids', $data) || array_key_exists('primary_category_id', $data)) {
                app(ProductCategories::class)->sync(
                    $product,
                    array_key_exists('category_ids', $data) ? array_values(array_map('intval', $data['category_ids'] ?? [])) : null,
                    isset($data['primary_category_id']) ? (int) $data['primary_category_id'] : null,
                    array_key_exists('primary_category_id', $data),
                );
            }

            if (array_key_exists('media_ids', $data)) {
                $this->syncMedia($product, array_map('intval', $data['media_ids'] ?? []));
            }

            if (array_key_exists('options', $data)) {
                $this->syncOptions($product, $data['options'] ?? []);
            }

            if ($product->stock_mode === Product::STOCK_VARIANT && array_key_exists('variants', $data)) {
                $this->syncVariants($product, $data['variants'] ?? []);
            }

            return $product;
        });

        if ($revalidate) {
            RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
        }

        return $product;
    }

    /** @param array<string, mixed> $data */
    private function fillStoreFields(Product $product, array $data): void
    {
        foreach (['short_description', 'in_store', 'is_featured', 'low_stock_threshold'] as $key) {
            if (array_key_exists($key, $data)) {
                $product->setAttribute($key, $data[$key]);
            }
        }
        if (array_key_exists('slug', $data) && $data['slug'] !== null) {
            $product->slug = $data['slug'];
        }
        if (array_key_exists('seo', $data)) {
            $product->seo = SeoInput::clean($data['seo']);
        }
        if (array_key_exists('stock_mode', $data)) {
            $product->stock_mode = $data['stock_mode'];
        }
        if ($product->stock_mode === Product::STOCK_PRODUCT && array_key_exists('stock', $data)) {
            $before = $product->exists ? (int) $product->getOriginal('stock') : 0;
            $product->stock = (int) ($data['stock'] ?? 0);
            if ($product->exists) {
                app(Stock::class)->logManual($product->id, null, $product->stock - $before);
            }
        }
    }

    /**
     * Variant stock rows from option name → value label combinations; unknown combinations
     * are ignored, combinations no longer possible are removed.
     *
     * @param  array<int, array{values: array<string, string>, stock: int, sku?: string|null}>  $variants
     */
    private function syncVariants(Product $product, array $variants): void
    {
        $product->load('options.values');
        $byName = $product->options->where('is_required', true)->keyBy(fn ($o) => mb_strtolower($o->name));
        $kept = [];

        foreach ($variants as $variant) {
            $ids = [];
            foreach ($variant['values'] as $optionName => $label) {
                $option = $byName->get(mb_strtolower((string) $optionName));
                $value = $option?->values->first(fn ($v) => mb_strtolower($v->label) === mb_strtolower((string) $label));
                if ($value === null) {
                    continue 2;
                }
                $ids[] = $value->id;
            }
            if (count($ids) !== $byName->count()) {
                continue;
            }

            $key = ProductVariant::keyFor($ids);
            $row = ProductVariant::query()->firstOrNew(['product_id' => $product->id, 'combination_key' => $key]);
            $before = $row->exists ? $row->stock : 0;
            $row->fill(['stock' => (int) $variant['stock'], 'sku' => $variant['sku'] ?? null])->save();
            app(Stock::class)->logManual($product->id, $row->id, $row->stock - $before);
            $kept[] = $row->id;
        }

        ProductVariant::query()->where('product_id', $product->id)->whereNotIn('id', $kept === [] ? [0] : $kept)->delete();
    }

    /** @param list<int> $mediaIds ordered; the first is the main image */
    private function syncMedia(Product $product, array $mediaIds): void
    {
        DB::table('product_media')->where('product_id', $product->id)->delete();

        $now = now();
        $rows = [];
        foreach (array_values(array_unique($mediaIds)) as $position => $mediaId) {
            $rows[] = [
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'media_id' => $mediaId,
                'position' => $position,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        if ($rows !== []) {
            DB::table('product_media')->insert($rows);
        }
    }

    /** @param array<int, array<string, mixed>> $options */
    private function syncOptions(Product $product, array $options): void
    {
        $keptOptionIds = [];

        foreach (array_values($options) as $position => $optionData) {
            $option = isset($optionData['id'])
                ? ProductOption::query()->where('product_id', $product->id)->findOrFail((int) $optionData['id'])
                : new ProductOption(['product_id' => $product->id]);

            $option->fill([
                'name' => $optionData['name'],
                'display_type' => $optionData['display_type'],
                'is_required' => (bool) ($optionData['is_required'] ?? true),
                'position' => $position,
            ])->save();

            $keptOptionIds[] = $option->id;
            $this->syncValues($option, $optionData['values'] ?? []);
        }

        ProductOption::query()
            ->where('product_id', $product->id)
            ->whereNotIn('id', $keptOptionIds === [] ? [0] : $keptOptionIds)
            ->delete();
    }

    /** @param array<int, array<string, mixed>> $values */
    private function syncValues(ProductOption $option, array $values): void
    {
        $isSwatch = $option->display_type->value === 'swatch';
        $keptValueIds = [];

        foreach (array_values($values) as $position => $valueData) {
            $value = isset($valueData['id'])
                ? ProductOptionValue::query()->where('option_id', $option->id)->findOrFail((int) $valueData['id'])
                : new ProductOptionValue(['option_id' => $option->id]);

            $value->fill([
                'label' => $valueData['label'],
                'color_hex' => $isSwatch ? ($valueData['color_hex'] ?? null) : null,
                'price_delta' => Money::toDecimal(Money::toCents((string) ($valueData['price_delta'] ?? '0'))),
                'is_active' => (bool) ($valueData['is_active'] ?? true),
                'position' => $position,
            ])->save();

            $keptValueIds[] = $value->id;
        }

        ProductOptionValue::query()
            ->where('option_id', $option->id)
            ->whereNotIn('id', $keptValueIds === [] ? [0] : $keptValueIds)
            ->delete();
    }
}
