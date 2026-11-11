<?php

declare(strict_types=1);

namespace App\Store;

use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Product;
use App\Models\Store;
use App\Models\StorePage;
use App\Models\Tenant;
use App\Pricing\Shipping;
use App\Services\PublicPageData;
use App\Services\PublicSite;
use Illuminate\Support\Collection;

/**
 * The store as visitors get it (runs inside the store's tenant context): is it live, its
 * theme, identity, menus with resolved links, categories, the published home with the data
 * its store sections need, shipping and tracking.
 */
final class StoreSite
{
    public function __construct(
        private readonly StoreSetup $setup,
        private readonly StoreCatalog $catalog,
        private readonly PublicPageData $data,
        private readonly PublicSite $site,
        private readonly Shipping $shipping,
        private readonly Entitlements $entitlements,
        private readonly SeoDefaults $seo,
    ) {}

    /** The live store of the tenant, or null (then "/" stays the landing home). */
    public function live(Tenant $tenant): ?Store
    {
        $store = Store::query()->with('homePage')->first();

        return $store !== null && $this->setup->isLive($tenant, $store) && $store->homePage?->isPublished() === true ? $store : null;
    }

    /** @return array<string, mixed> */
    public function config(Store $store, string $primaryHost): array
    {
        $home = $store->homePage;
        $identity = $this->identity($home);
        $categories = $this->catalog->categoryRows();
        $pages = StorePage::query()->where('is_published', true)->orderBy('position')->orderBy('id')->get(['id', 'title', 'slug']);
        $content = $home?->published_content ?? ['version' => 1, 'sections' => []];
        unset($content['theme_key']);
        $tracking = $home === null ? null : $this->site->tracking($home, $identity);

        return [
            'theme_key' => $store->theme_key,
            'settings' => $store->resolvedSettings(),
            'identity' => $identity === null ? null : $this->data->identity($identity),
            'menus' => [
                'header' => $this->menu($store->menus['header'] ?? [], $categories, $pages),
                'footer' => $this->menu($store->menus['footer'] ?? [], $categories, $pages),
            ],
            'categories' => $categories,
            'pages' => $pages->map(fn (StorePage $p) => ['title' => $p->title, 'slug' => $p->slug])->all(),
            'home' => [
                'id' => $home?->id,
                'content' => $content,
                'media' => (object) $this->data->media($content),
                'data' => $this->sectionData($content),
            ],
            'seo' => [
                'title' => $store->seo['title'] ?? $identity?->seo_title ?? $identity?->brand_name ?? '',
                'description' => $store->seo['description'] ?? $identity?->seo_description ?? '',
                'canonical' => PublicSite::url($primaryHost),
                'site_name' => $identity?->brand_name,
            ],
            'tracking' => $tracking,
            'shipping' => $this->shipping->publicConfig(),
            'branding' => ! $this->entitlements->allows(PlanFeature::RemoveBranding),
            'primary_host' => $primaryHost,
        ];
    }

    /**
     * Data the store sections of a content need: products of product grids (by section id)
     * and the categories of category grids.
     *
     * @param  array<string, mixed>  $content
     * @return array{products: array<string, list<array<string, mixed>>>}
     */
    public function sectionData(array $content): array
    {
        $products = [];
        foreach ($content['sections'] ?? [] as $section) {
            if (($section['type'] ?? null) === 'product_grid' && ($section['visible'] ?? true)) {
                $products[(string) $section['id']] = $this->catalog->forSection((array) ($section['props'] ?? []));
            }
        }

        return ['products' => (object) $products];
    }

    public function identity(?LandingPage $home): ?Identity
    {
        $identity = $home?->identity;
        if ($identity !== null && ! $identity->trashed()) {
            return $identity;
        }

        return Identity::query()->where('is_default', true)->first() ?? Identity::query()->first();
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
    public function product(string $slug): ?array
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
            'related' => $this->catalog->related($product),
            'low_stock_threshold' => $product->low_stock_threshold,
        ];
    }
}
