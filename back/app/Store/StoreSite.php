<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Identity;
use App\Models\Product;
use App\Models\Store;
use App\Models\StorePage;
use App\Models\Tenant;
use App\Pricing\Shipping;
use App\Services\PublicPageData;
use App\Services\PublicSite;
use App\Store\Accounts\ProductReviews;
use App\Store\Design\AsasDesign;
use App\Store\Design\StoreDesigner;
use App\Support\Pixels;
use Illuminate\Support\Collection;

/**
 * The store as visitors get it (runs inside the store's tenant context): is it live, its theme
 * with the published design and what its sections show, menus with resolved links, categories,
 * shipping and tracking.
 */
final class StoreSite
{
    public function __construct(
        private readonly StoreSetup $setup,
        private readonly StoreCatalog $catalog,
        private readonly PublicPageData $data,
        private readonly PublicSite $site,
        private readonly Shipping $shipping,
        private readonly SeoDefaults $seo,
        private readonly StoreDesigner $designer,
        private readonly ProductReviews $reviews,
    ) {}

    /** The live store of the tenant, or null (then "/" stays the landing home). */
    public function live(Tenant $tenant): ?Store
    {
        $store = Store::query()->first();

        return $this->setup->isLive($tenant, $store) ? $store : null;
    }

    /** «إظهار المنتجات اللي خلصت» of the published design (on by default). */
    public static function showsOutOfStock(Store $store): bool
    {
        return (bool) ($store->design()?->published['settings']['general']['show_out_of_stock'] ?? true);
    }

    /** Products per page of the store lists (published design). */
    public static function perPage(Store $store): int
    {
        return (int) ($store->design()?->published['settings']['general']['products_per_page'] ?? 24);
    }

    /** @return array<string, mixed> */
    public function config(Store $store, string $primaryHost): array
    {
        $design = $store->design()?->published ?? AsasDesign::defaults();
        $identity = Identity::query()->where('is_default', true)->first() ?? Identity::query()->first();
        $categories = $this->catalog->categoryRows();
        $pages = StorePage::query()->where('is_published', true)->orderBy('position')->orderBy('id')->get(['id', 'title', 'slug']);
        $name = $this->seo->storeName();

        return [
            'theme_key' => $store->theme_key,
            'design' => $design,
            'data' => $this->designer->data($design),
            'store_name' => $name,
            'menus' => [
                'header' => $this->menu($store->menus['header'] ?? [], $categories, $pages),
                'footer' => $this->menu($store->menus['footer'] ?? [], $categories, $pages),
            ],
            'categories' => $categories,
            'pages' => $pages->map(fn (StorePage $p) => ['title' => $p->title, 'slug' => $p->slug])->all(),
            'seo' => [
                'title' => $store->seo['title'] ?? $name,
                'description' => $store->seo['description'] ?? $identity?->seo_description ?? '',
                'canonical' => PublicSite::url($primaryHost),
                'site_name' => $name,
            ],
            'tracking' => app(Pixels::class)->forStore($store->tenant_id),
            'shipping' => $this->shipping->publicConfig(now()),
            // «صنع بواسطة مكسب» always shows for now (owner: removable later on Max).
            'branding' => true,
            'primary_host' => $primaryHost,
        ];
    }

    /**
     * Menu items with their link (unknown or hidden targets are dropped).
     *
     * @param  list<array<string, mixed>>  $items
     * @param  list<array<string, mixed>>  $categories
     * @param  Collection<int, StorePage>  $pages
     * @return list<array{label: string, href: string, children: list<array{label: string, href: string}>}>
     */
    private function menu(array $items, array $categories, Collection $pages): array
    {
        $categoriesById = collect($categories)->keyBy('id');
        $out = [];
        foreach ($items as $item) {
            $href = match ($item['type'] ?? null) {
                'home' => '/',
                'all_products' => '/products',
                'category' => ($c = $categoriesById->get($item['target_id'] ?? 0)) ? '/categories/'.rawurlencode($c['slug']) : null,
                'page' => ($p = $pages->firstWhere('id', $item['target_id'] ?? 0)) ? '/pages/'.rawurlencode($p->slug) : null,
                'product' => ($slug = $this->catalog->sellable()->whereKey($item['target_id'] ?? 0)->value('slug')) ? '/products/'.rawurlencode((string) $slug) : null,
                'landing' => ($slug = $this->site->publishedPages()->whereKey($item['target_id'] ?? 0)->value('slug')) ? '/'.rawurlencode((string) $slug) : null,
                'url' => $item['url'] ?? null,
                default => null,
            };
            if ($href === null) {
                continue;
            }
            $children = array_values(array_map(fn (array $c) => ['label' => $c['label'], 'href' => $c['href']], $this->menu($item['children'] ?? [], $categories, $pages)));
            $out[] = ['label' => (string) $item['label'], 'href' => $href, 'children' => $children];
        }

        return $out;
    }

    /** A sellable product by slug with what its page needs. @return array<string, mixed>|null */
    public function product(Store $store, string $slug): ?array
    {
        $product = $this->catalog->sellable()->with(['options.values', 'media', 'variants', 'categories'])->where('slug', $slug)->first();
        if (! $product instanceof Product) {
            return null;
        }

        $visible = $this->catalog->visibleCategories()->keyBy('id');
        // The main category first (when visible), else the first visible one.
        $category = $visible->has($product->primary_category_id ?? 0) ? $visible->get($product->primary_category_id) : $product->categories->first(fn ($c) => $visible->has($c->id));
        $trail = [];
        for ($c = $category === null ? null : $visible->get($category->id); $c !== null; $c = $c->parent_id === null ? null : $visible->get($c->parent_id)) {
            array_unshift($trail, ['name' => $c->name, 'slug' => $c->slug]);
        }

        return [
            'product' => $this->data->product($product),
            'offers' => $this->data->offers($product, now()),
            'breadcrumb' => $trail,
            'seo' => SeoDefaults::merge($product->seo, $this->seo->product($product, $this->seo->storeName())),
            'related' => $this->catalog->related($product, ! self::showsOutOfStock($store)),
            'rating' => $this->reviews->summary($product->id),
            'low_stock_threshold' => $product->low_stock_threshold,
        ];
    }
}
