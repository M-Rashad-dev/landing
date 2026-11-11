<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Product;
use Illuminate\Validation\ValidationException;

/**
 * A product's categories and its main one. The main category is always one of the product's
 * categories: the chosen one, else the first; none when the product has no category.
 */
final class ProductCategories
{
    /**
     * @param  list<int>|null  $ids  null = keep the current categories
     * @param  bool  $primaryGiven  whether the request carried primary_category_id
     */
    public function sync(Product $product, ?array $ids, ?int $primary, bool $primaryGiven): void
    {
        if ($ids !== null) {
            $product->categories()->sync($ids);
        } else {
            $ids = $product->categories()->pluck('categories.id')->map(fn ($id) => (int) $id)->all();
        }

        if ($primaryGiven && $primary !== null && ! in_array($primary, $ids, true)) {
            throw ValidationException::withMessages(['primary_category_id' => [__('store.primary_not_in_categories')]]);
        }

        $keep = $primaryGiven ? $primary : $product->primary_category_id;
        $main = $keep !== null && in_array($keep, $ids, true) ? $keep : ($ids[0] ?? null);

        if ($product->primary_category_id !== $main) {
            $product->forceFill(['primary_category_id' => $main])->save();
        }
    }

    /**
     * After categories were unlinked from products: products left without a valid main category
     * take their first remaining one.
     *
     * @param  list<int>  $productIds
     */
    public function repair(array $productIds): void
    {
        if ($productIds === []) {
            return;
        }

        Product::query()->whereIn('id', $productIds)->with('categories:id')->get()->each(function (Product $product): void {
            $ids = $product->categories->pluck('id')->map(fn ($id) => (int) $id)->all();
            $main = in_array($product->primary_category_id, $ids, true) ? $product->primary_category_id : ($ids[0] ?? null);
            if ($product->primary_category_id !== $main) {
                $product->forceFill(['primary_category_id' => $main])->save();
            }
        });
    }
}
