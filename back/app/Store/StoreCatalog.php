<?php

declare(strict_types=1);

namespace App\Store;

use App\Enums\PromotionTarget;
use App\Models\Category;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Services\PublicPageData;
use App\Store\Payments\StorePayments;
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
     * @param  array{category?: string|null, q?: string|null, sort?: string|null, min?: int|float|null, max?: int|float|null, in_stock?: bool|null, offers?: bool|null, page?: int|null}  $filters
     * @return LengthAwarePaginator<int, Product>
     */
    public function search(array $filters, int $perPage): LengthAwarePaginator
    {
        $query = $this->withRatings($this->sellable()->with(['media', 'variants', 'options', 'inputs']));

        if (($filters['offers'] ?? false) === true) {
            $this->onOffer($query);
        }

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
            $this->inStock($query);
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
     * Products of a home «قائمة منتجات»: the latest, the ones on offer (a lower price than the
     * old one, or covered by an active offer), or a category with the ones under it.
     *
     * @return list<array<string, mixed>>
     */
    public function forSection(string $source, ?int $categoryId, int $limit, bool $inStockOnly = false): array
    {
        $query = $this->withRatings($this->sellable()->with(['media', 'variants', 'options', 'inputs']));
        if ($inStockOnly) {
            $this->inStock($query);
        }

        if ($source === 'category') {
            $ids = $categoryId === null ? [0] : $this->categories->withDescendants($categoryId);
            $query->whereHas('categories', fn (Builder $q) => $q->whereIn('categories.id', $ids));
        } elseif ($source === 'offers') {
            $this->onOffer($query);
        }

        return $query->orderByDesc('id')->limit(max(1, min(32, $limit)))->get()->map(fn (Product $p) => $this->card($p))->all();
    }

    /**
     * Products the merchant picked, in the order picked (gone or hidden ones are skipped).
     *
     * @param  list<int>  $ids
     * @return list<array<string, mixed>>
     */
    public function cards(array $ids, bool $inStockOnly = false): array
    {
        if ($ids === []) {
            return [];
        }
        $query = $this->withRatings($this->sellable()->with(['media', 'variants', 'options', 'inputs']))->whereIn('id', $ids);
        if ($inStockOnly) {
            $this->inStock($query);
        }
        $found = $query->get()->keyBy('id');

        return collect($ids)->map(fn (int $id) => $found->get($id))->filter()->map(fn (Product $p) => $this->card($p))->values()->all();
    }

    /**
     * The average and number of visible reviews on each product of the list.
     *
     * @param  Builder<Product>  $query
     * @return Builder<Product>
     */
    private function withRatings(Builder $query): Builder
    {
        $visible = fn (Builder $q) => $q->where('is_hidden', false);

        return $query->withAvg(['reviews as rating_average' => $visible], 'rating')->withCount(['reviews as rating_count' => $visible]);
    }

    /**
     * Products a customer can buy now: unlimited, units left, or a combination with units left.
     *
     * @param  Builder<Product>  $query
     */
    public function inStock(Builder $query): void
    {
        $query->where(fn (Builder $q) => $q
            ->where('stock_mode', Product::STOCK_UNLIMITED)
            ->orWhere(fn (Builder $p) => $p->where('stock_mode', Product::STOCK_PRODUCT)->where('stock', '>', 0))
            ->orWhere(fn (Builder $v) => $v->where('stock_mode', Product::STOCK_VARIANT)->whereHas('variants', fn (Builder $r) => $r->where('stock', '>', 0))));
    }

    /** @param Builder<Product> $query */
    public function onOffer(Builder $query): void
    {
        $offers = Offer::query()->activeAt(now())->servable()->with(['products:id', 'categories:id'])->get();
        if ($offers->contains(fn (Offer $o) => $o->applies_to === PromotionTarget::All)) {
            return;
        }
        $productIds = $offers->flatMap(fn (Offer $o) => $o->applies_to === PromotionTarget::Products ? $o->products->pluck('id') : [])->unique()->values()->all();
        $categoryIds = [];
        foreach ($offers as $offer) {
            if ($offer->applies_to === PromotionTarget::Categories) {
                foreach ($offer->categories as $category) {
                    array_push($categoryIds, ...$this->categories->withDescendants($category->id));
                }
            }
        }

        $query->where(fn (Builder $w) => $w->whereColumn('compare_at_price', '>', 'price')
            ->orWhereIn('id', $productIds === [] ? [0] : $productIds)
            ->orWhereHas('categories', fn (Builder $c) => $c->whereIn('categories.id', $categoryIds === [] ? [0] : array_values(array_unique($categoryIds)))));
    }

    /** @return list<array<string, mixed>> related products (same categories), for a product page */
    public function related(Product $product, bool $inStockOnly = false, int $limit = 8): array
    {
        $ids = $product->categories->pluck('id')->all();
        $query = $this->withRatings($this->sellable()->with(['media', 'variants', 'options', 'inputs']))->whereKeyNot($product->id);
        if ($inStockOnly) {
            $this->inStock($query);
        }
        if ($ids !== []) {
            $query->whereHas('categories', fn (Builder $q) => $q->whereIn('categories.id', $ids));
        }

        return $query->orderByDesc('is_featured')->orderByDesc('id')->limit($limit)->get()->map(fn (Product $p) => $this->card($p))->all();
    }

    /** Words too common to say two products are alike. */
    private const STOP_WORDS = ['اللي', 'على', 'علي', 'الى', 'الي', 'مع', 'من', 'في', 'عن', 'هذا', 'هذه', 'ده', 'دي', 'كل', 'جدا', 'the', 'and', 'for', 'with'];

    /**
     * Products like this one, for «اطلبه مع» set to «مشابهة»: the ones sharing words of its name or
     * short description (Arabic letters unified: أ/إ/آ → ا، ة → ه، ى → ي) and its categories, the best
     * matches first. Falls back to the same-category list when nothing shares a word.
     *
     * @return list<array<string, mixed>>
     */
    public function similar(Product $product, bool $inStockOnly = false, int $limit = 8): array
    {
        $words = self::words($product->name.' '.$product->short_description);
        $categoryIds = $product->categories->pluck('id')->all();
        if ($words === []) {
            return $this->related($product, $inStockOnly, $limit);
        }
        $query = $this->withRatings($this->sellable()->with(['media', 'variants', 'options', 'inputs', 'categories']))->whereKeyNot($product->id);
        if ($inStockOnly) {
            $this->inStock($query);
        }
        $query->where(function (Builder $q) use ($words, $categoryIds): void {
            foreach ($words as $word) {
                $like = '%'.addcslashes($word, '%_\\').'%';
                $q->orWhere('name', 'like', $like)->orWhere('short_description', 'like', $like);
            }
            if ($categoryIds !== []) {
                $q->orWhereHas('categories', fn (Builder $c) => $c->whereIn('categories.id', $categoryIds));
            }
        });
        $scored = $query->orderByDesc('id')->limit(200)->get()
            ->map(function (Product $p) use ($words, $categoryIds): array {
                $name = self::words($p->name);
                $about = self::words((string) $p->short_description);
                $score = 3 * count(array_intersect($words, $name)) + count(array_intersect($words, $about))
                    + 2 * count(array_intersect($categoryIds, $p->categories->pluck('id')->all()));

                return ['product' => $p, 'score' => $score];
            })
            ->filter(fn (array $row) => $row['score'] > 0)
            ->sortBy([['score', 'desc'], [fn (array $a, array $b) => $b['product']->id <=> $a['product']->id]])
            ->take($limit);

        return $scored->isEmpty()
            ? $this->related($product, $inStockOnly, $limit)
            : $scored->map(fn (array $row) => $this->card($row['product']))->values()->all();
    }

    /** @return list<string> the distinct meaningful words of a text, letters unified */
    private static function words(string $text): array
    {
        $text = mb_strtolower(strip_tags($text));
        $text = (string) preg_replace('/[\x{064B}-\x{065F}\x{0640}]/u', '', $text);
        $text = strtr($text, ['أ' => 'ا', 'إ' => 'ا', 'آ' => 'ا', 'ة' => 'ه', 'ى' => 'ي']);
        $words = preg_split('/[^\p{L}\p{N}]+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $words = array_filter($words, fn (string $w) => mb_strlen($w) >= 3 && ! in_array($w, self::STOP_WORDS, true));

        return array_slice(array_values(array_unique($words)), 0, 8);
    }

    /** @return array<string, mixed> */
    public function card(Product $p): array
    {
        $price = $p->priceCents();
        $compare = $p->compareAtCents();
        /** @var Media|null $image */
        $image = $p->media->first();
        /** @var Media|null $second */
        $second = $p->media->skip(1)->first();

        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'name' => $p->name,
            'short_description' => $p->short_description,
            'price' => Money::toFloat($price),
            'compare_at_price' => $compare === null ? null : Money::toFloat($compare),
            'discount_percent' => $compare !== null && $compare > $price ? (int) round(($compare - $price) * 100 / $compare) : null,
            'image' => $this->data->image($image),
            // Shown when the card is hovered (themes that use it).
            'image_2' => $this->data->image($second),
            'available' => $p->inStock() && (! $p->isDigital() || app(StorePayments::class)->prepaidReady()),
            'digital' => $p->isDigital(),
            'is_featured' => $p->is_featured,
            // A card can be added to the cart directly when nothing must be chosen.
            'needs_options' => $p->needsChoices(),
            // Units in stock for a card that adds to the cart directly (null: no limit, or per option).
            'max_quantity' => $p->stock_mode === Product::STOCK_PRODUCT ? max(0, (int) $p->stock) : null,
            'rating' => (int) ($p->getAttribute('rating_count') ?? 0) > 0
                ? ['average' => round((float) $p->getAttribute('rating_average'), 1), 'count' => (int) $p->getAttribute('rating_count')]
                : null,
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
