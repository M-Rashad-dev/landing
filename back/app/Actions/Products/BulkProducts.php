<?php

declare(strict_types=1);

namespace App\Actions\Products;

use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Category;
use App\Models\Product;
use App\Store\ProductCategories;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * Show / hide / delete / add to a category / remove from a category, for several products.
 * Deleting skips products a live page still uses and reports them (same rule as one delete).
 */
final class BulkProducts
{
    public const ACTIONS = ['activate', 'deactivate', 'delete', 'add_category', 'remove_category'];

    public function __construct(private readonly DeleteProduct $delete, private readonly ProductCategories $categories) {}

    /**
     * @param  list<int>  $ids
     * @return array{done: int, skipped: list<array{id: int, name: string}>}
     */
    public function handle(string $action, array $ids, ?int $categoryId = null): array
    {
        $products = Product::query()->whereIn('id', $ids)->get();
        $skipped = [];

        DB::transaction(function () use ($action, $products, $categoryId, &$skipped): void {
            match ($action) {
                'activate', 'deactivate' => Product::query()->whereIn('id', $products->modelKeys())->update(['is_active' => $action === 'activate']),
                'add_category' => $this->addCategory($products->all(), (int) $categoryId),
                'remove_category' => $this->removeCategory($products->all(), (int) $categoryId),
                'delete' => $products->each(function (Product $product) use (&$skipped): void {
                    try {
                        $this->delete->handle($product);
                    } catch (ApiException) {
                        $skipped[] = ['id' => $product->id, 'name' => $product->name];
                    }
                }),
            };
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return ['done' => $products->count() - count($skipped), 'skipped' => $skipped];
    }

    /** @param list<Product> $products */
    private function addCategory(array $products, int $categoryId): void
    {
        Category::query()->findOrFail($categoryId)->products()->syncWithoutDetaching(array_map(fn (Product $p) => $p->id, $products));
        // Products that had no category take this one as their main category.
        $this->categories->repair(array_map(fn (Product $p) => $p->id, $products));
    }

    /** @param list<Product> $products */
    private function removeCategory(array $products, int $categoryId): void
    {
        Category::query()->findOrFail($categoryId)->products()->detach(array_map(fn (Product $p) => $p->id, $products));
        $this->categories->repair(array_map(fn (Product $p) => $p->id, $products));
    }
}
