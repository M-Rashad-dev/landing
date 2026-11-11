<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Category;
use App\Models\Media;
use App\Models\Product;
use App\Services\PublicPageData;
use App\Support\Money;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * What visitors of a store see (runs inside the store's tenant context): sellable products,
 * visible categories, cards and filters. Locked rows (plan downgrade) never show.
 */
final class StoreCatalog
{
    public const SORTS = ['newest', 'price_asc', 'price_desc', 'best_sellers', 'featured'];

    public function __construct(
        private readonly Categories $categories,
        private readonly PublicPageData $data,
        private readonly SeoDefaults $seo,
    ) {}

    /** @return Builder<Product> */
    public function sellable(): Builder
    {
        return Product::query()->where('in_store', true)->where('is_active', true)->servable();
    }

    /**
     * @param  array{category?: string|null, q?: string|null, sort?: string|null, min?: int|float|null, max?: int|float|null, in_stock?: bool|null, page?: int|null}  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function search(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = $this->sellable()->with(['media', 'variants', 'options']);

        if (! empty($filters['category'])) {
            $category = $this->visibleCategories()->firstWhere('slug', $filters['category']);
            $ids = $category === null ? [0] : $this->categories->withDescendants($category->id);
            $query->whereHas('categories', fn (Builder $q) => $q->whereIn('categories.id', $ids));
        }
        if (! empty($filters['q'])) {
            $like = '%'.addcslashes(mb_substr(trim((string) $filters['q']), 0, 60), '%_\\').'%';
            $query->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('short_description', 'like', $like));
        }
        if (isset($filters['min']) && $filters['min'] !== null) {
            $query->where('price', '>=', Money::toDecimal(Money::toCents((string) $filters['min'])));
        }
        if (isset($filters['max']) && $filters['max'] !== null) {
            $query->where('price', '<=', Money::toDecimal(Money::toCents((string) $filters['max'])));
        }
        if (($filters['in_stock'] ?? false) === true) {
            $query->where(fn (Builder $q) => $q
                ->where('stock_mode', Product::STOCK_UNLIMITED)
                ->orWhere(fn (Builder $p) => $p->where('stock_mode', Product::STOCK_PRODUCT)->where('stock', '>', 0))
                ->orWhere(fn (Builder $v) => $v->where('stock_mode', Product::STOCK_VARIANT)->whereHas('variants', fn (Builder $r) => $r->where('stock', '>', 0))));
        }

        match ($filters['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('price')->orderByDesc('id'),
            'price_desc' => $query->orderByDesc('price')->orderByDesc('id'),
            'best_sellers' => $query->withSum('orderItems as sold', 'quantity')->orderByDesc('sold')->orderByDesc('id'),
            'featured' => $query->orderByDesc('is_featured')->orderByDesc('id'),
            default => $query->orderByDesc('id'),
        };

        return $query->paginate($perPage, ['*'], 'page', max(1, (int) ($filters['page'] ?? 1)));
    }

    /**
     * Products of a store-home product grid section.
     *
     * @param  array<string, mixed>  $props
     * @return list<array<string, mixed>>
     */
    public function forSection(array $props): array
    {
        $limit = max(1, min(24, (int) ($props['limit'] ?? 8)));
        $source = (string) ($props['source'] ?? 'newest');
        $query = $this->sellable()->with(['media', 'variants', 'options']);

        if ($source === 'category' && ! empty($props['category_id'])) {
            $ids = $this->categories->withDescendants((int) $props['category_id']);
            $query->whereHas('categories', fn (Builder $q) => $q->whereIn('categories.id', $ids));
        } elseif ($source === 'featured') {
            $query->where('is_featured', true);
        } elseif ($source === 'best_sellers') {
            $query->withSum('orderItems as sold', 'quantity')->orderByDesc('sold');
        }

        return $query->orderByDesc('id')->limit($limit)->get()->map(fn (Product $p) => $this->card($p))->all();
    }

    /** @return list<array<string, mixed>> related products (same categories), for a product page */
    public function related(Product $product, int $limit = 8): array
    {
        $ids = $product->categories->pluck('id')->all();
        $query = $this->sellable()->with(['media', 'variants', 'options'])->whereKeyNot($product->id);
        if ($ids !== []) {
            $query->whereHas('categories', fn (Builder $q) => $q->whereIn('categories.id', $ids));
        }

        return $query->orderByDesc('is_featured')->orderByDesc('id')->limit($limit)->get()->map(fn (Product $p) => $this->card($p))->all();
    }

    /** @return array<string, mixed> */
    public function card(Product $p): array
    {
        $price = $p->priceCents();
        $compare = $p->compareAtCents();
        /** @var Media|null $image */
        $image = $p->media->first();

        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'name' => $p->name,
            'short_description' => $p->short_description,
            'price' => Money::toFloat($price),
            'compare_at_price' => $compare === null ? null : Money::toFloat($compare),
            'discount_percent' => $compare !== null && $compare > $price ? (int) round(($compare - $price) * 100 / $compare) : null,
            'image' => $this->data->image($image),
            'available' => $p->inStock(),
            'is_featured' => $p->is_featured,
            // A card can be added to the cart directly when nothing must be chosen.
            'needs_options' => $p->options->contains(fn ($o) => $o->is_required),
        ];
    }

    /** Visible, servable categories (a hidden parent hides its children). @return Collection<int, Category> */
    public function visibleCategories(): Collection
    {
        $all = $this->categories->tree();
        $hidden = [];
        foreach ($all as $category) {
            if (! $category->is_visible || $category->isLockedByPlan() || in_array($category->parent_id, $hidden, true)) {
                $hidden[] = $category->id;
            }
        }

        return $all->reject(fn (Category $c) => in_array($c->id, $hidden, true))->values();
    }

    /** @return list<array<string, mixed>> */
    public function categoryRows(): array
    {
        // Sellable products per category (direct members, like the dashboard count).
        $counts = Category::query()
            ->withCount(['products as sellable_count' => fn (Builder $q) => $q->where('in_store', true)->where('is_active', true)->servable()])
            ->pluck('sellable_count', 'id');

        $visible = $this->visibleCategories();
        $byId = $visible->keyBy('id');
        $store = $this->seo->storeName();
        $ancestors = function (Category $c) use ($byId): array {
            $names = [];
            for ($p = $byId->get($c->parent_id ?? 0); $p !== null; $p = $byId->get($p->parent_id ?? 0)) {
                $names[] = $p->name;
            }

            return $names;
        };

        return $visible->map(fn (Category $c) => [
            'id' => $c->id,
            'parent_id' => $c->parent_id,
            'depth' => $c->depth,
            'name' => $c->name,
            'slug' => $c->slug,
            'description' => $c->description,
            'image' => $this->data->image($c->image),
            'products_count' => (int) ($counts[$c->id] ?? 0),
            'seo' => SeoDefaults::merge($c->seo, $this->seo->category($c, $store, $ancestors($c))),
        ])->values()->all();
    }
}
