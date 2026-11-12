<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Models\Category;
use App\Models\Product;

/**
 * The categories a product belongs to for promotions: its own categories and every category
 * above them (an offer on "Clothes" covers a product in "Clothes > Men > Shirts").
 * Runs inside the tenant context (one query for the tree, one for the products' categories).
 */
final class CategoryAncestry
{
    /**
     * @param  iterable<Product>  $products
     * @return array<int, list<int>> product id => category ids
     */
    public function forProducts(iterable $products): array
    {
        $list = collect($products)->filter()->values();
        if ($list->isEmpty()) {
            return [];
        }

        $list->each(fn (Product $p) => $p->loadMissing('categories:id'));
        $parents = Category::query()->pluck('parent_id', 'id')->all();

        $out = [];
        foreach ($list as $product) {
            $ids = [];
            foreach ($product->categories as $category) {
                // Five levels at most; the guard stops a broken tree from looping.
                for ($id = $category->id, $guard = 0; $id !== null && $guard < 10; $guard++) {
                    $ids[$id] = true;
                    $id = isset($parents[$id]) ? (int) $parents[$id] : null;
                }
            }
            $out[$product->id] = array_map('intval', array_keys($ids));
        }

        return $out;
    }
}
