<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;

/**
 * The dashboard product list: search, status tab, category (with its sub-categories), sort
 * (stock problems have their own tabs),
 * and the count of every tab. Stock states:
 * - out: tracked and nothing left (variant mode: no combination left);
 * - low: something left but at or under the product's alert (default 5);
 *   in variant mode, at least one combination is low or out while another is still available.
 */
final class ProductList
{
    public const LOW_STOCK_DEFAULT = 5;

    public const STATUSES = ['all', 'active', 'inactive', 'out', 'low'];

    public const SORTS = ['latest', 'oldest', 'name', 'price_asc', 'price_desc'];

    public function __construct(private readonly Categories $categories) {}

    /**
     * @param  array{q?: string|null, category_id?: int|null, status?: string|null, sort?: string|null}  $filters
     * @return Builder<Product>
     */
    public function query(array $filters): Builder
    {
        $query = $this->filtered($filters);
        $this->status($query, $filters['status'] ?? 'all');

        return $this->sort($query, $filters['sort'] ?? 'latest');
    }

    /**
     * Tab counts for the same search and category.
     *
     * @param  array{q?: string|null, category_id?: int|null}  $filters
     * @return array<string, int>
     */
    public function counts(array $filters): array
    {
        $counts = [];
        foreach (self::STATUSES as $status) {
            $query = $this->filtered($filters);
            $this->status($query, $status);
            $counts[$status] = $query->count();
        }

        return $counts;
    }

    /**
     * @param  array{q?: string|null, category_id?: int|null}  $filters
     * @return Builder<Product>
     */
    private function filtered(array $filters): Builder
    {
        $search = trim((string) ($filters['q'] ?? ''));
        $categoryId = $filters['category_id'] ?? null;

        return Product::query()
            ->when($search !== '', function (Builder $q) use ($search) {
                $like = '%'.addcslashes($search, '%_\\').'%';
                $q->where(fn (Builder $w) => $w->where('name', 'like', $like)->orWhere('sku', 'like', $like));
            })
            ->when($categoryId !== null, function (Builder $q) use ($categoryId) {
                $ids = $this->categories->withDescendants($categoryId);
                $q->whereHas('categories', fn (Builder $c) => $c->whereIn('categories.id', $ids));
            });
    }

    /** @param Builder<Product> $query */
    private function status(Builder $query, string $status): void
    {
        match ($status) {
            'active' => $query->where('is_active', true),
            'inactive' => $query->where('is_active', false),
            'out' => $query->where(fn (Builder $q) => $this->out($q)),
            'low' => $query->where(fn (Builder $q) => $this->low($q)),
            default => null,
        };
    }

    /** @param Builder<Product> $q */
    private function out(Builder $q): void
    {
        $q->where(fn (Builder $p) => $p->where('stock_mode', Product::STOCK_PRODUCT)->where('stock', '<=', 0))
            ->orWhere(fn (Builder $v) => $v->where('stock_mode', Product::STOCK_VARIANT)->whereDoesntHave('variants', fn (Builder $r) => $r->where('stock', '>', 0)));
    }

    /** @param Builder<Product> $q */
    private function low(Builder $q): void
    {
        $q->where(function (Builder $p) {
            $p->where('stock_mode', Product::STOCK_PRODUCT)->where('stock', '>', 0)->where(function (Builder $t) {
                $t->where(fn (Builder $own) => $own->whereNotNull('low_stock_threshold')->whereColumn('stock', '<=', 'low_stock_threshold'))
                    ->orWhere(fn (Builder $def) => $def->whereNull('low_stock_threshold')->where('stock', '<=', self::LOW_STOCK_DEFAULT));
            });
        })->orWhere(function (Builder $v) {
            $v->where('stock_mode', Product::STOCK_VARIANT)
                ->whereHas('variants', fn (Builder $r) => $r->where('stock', '>', 0))
                ->whereHas('variants', function (Builder $r) {
                    $r->where(fn (Builder $t) => $t->whereNotNull('products.low_stock_threshold')->whereColumn('product_variants.stock', '<=', 'products.low_stock_threshold'))
                        ->orWhere(fn (Builder $t) => $t->whereNull('products.low_stock_threshold')->where('product_variants.stock', '<=', self::LOW_STOCK_DEFAULT));
                });
        });
    }

    /**
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    private function sort(Builder $query, string $sort): Builder
    {
        return match ($sort) {
            'oldest' => $query->oldest('id'),
            'name' => $query->orderBy('name')->orderBy('id'),
            'price_asc' => $query->orderBy('price')->orderBy('id'),
            'price_desc' => $query->orderByDesc('price')->orderByDesc('id'),
            default => $query->latest('id'),
        };
    }
}
