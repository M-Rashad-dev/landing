<?php

declare(strict_types=1);

namespace App\Actions\Products;

use App\Billing\Entitlements;
use App\Enums\PlanLimit;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * Creates or updates a product with its options, values and images in one
 * transaction. Nested items are synced by id: with id → update, without → create,
 * missing from the request → delete (old orders keep their own snapshot).
 */
final class SaveProduct
{
    /** @param array<string, mixed> $data validated ProductRequest data */
    public function handle(array $data, ?Product $product = null): Product
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
            ])->save();

            if (array_key_exists('media_ids', $data)) {
                $this->syncMedia($product, array_map('intval', $data['media_ids'] ?? []));
            }

            if (array_key_exists('options', $data)) {
                $this->syncOptions($product, $data['options'] ?? []);
            }

            return $product;
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $product;
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
