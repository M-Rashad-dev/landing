<?php

declare(strict_types=1);

namespace App\Themes\Store;

use App\Ai\Designer\AiSectionDefinitions;
use App\Enums\PromotionTarget;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Category;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Store;
use App\Models\StoreDesign;
use App\Models\StorePage;
use App\Services\PublicPageData;
use App\Store\Accounts\ProductReviews;
use App\Store\StoreCatalog;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * The store design in the Builder: the draft of the active theme (created with the starter
 * design), saving it (validated, with a version against lost updates), publishing it, and the
 * data its sections show (products, links, images, categories for the header, pages for the footer).
 * Runs inside the tenant context.
 */
final class StoreDesigner
{
    public function __construct(
        private readonly StoreThemes $themes,
        private readonly StoreCatalog $catalog,
        private readonly ProductReviews $reviews,
        private readonly PublicPageData $pageData,
    ) {}

    /**
     * The starter design of a store theme (unknown keys fall back to «أساس»).
     *
     * @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    public function defaults(string $themeKey, ?int $logoMediaId = null): array
    {
        return $this->themes->for($themeKey)->defaults($logoMediaId);
    }

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    private function validate(string $themeKey, mixed $draft): array
    {
        return $this->themes->for($themeKey)->validate($draft);
    }

    public function for(Store $store): StoreDesign
    {
        $design = $store->design();
        if ($design !== null) {
            return $design;
        }
        $logo = Identity::query()->where('is_default', true)->value('logo_media_id');

        return StoreDesign::query()->firstOrCreate(
            ['theme_key' => $store->theme_key],
            ['draft' => $this->defaults($store->theme_key, $logo === null ? null : (int) $logo), 'version' => 1],
        );
    }

    /** @param mixed $draft what the Builder sent */
    public function save(StoreDesign $design, mixed $draft, int $version): StoreDesign
    {
        $clean = $this->validate($design->theme_key, $draft);

        return DB::transaction(function () use ($design, $clean, $version): StoreDesign {
            /** @var StoreDesign $locked */
            $locked = StoreDesign::query()->whereKey($design->id)->lockForUpdate()->firstOrFail();
            if ($locked->version !== $version) {
                throw new ApiException(409, 'design_changed', __('design.changed'));
            }
            $locked->forceFill(['draft' => $clean, 'version' => $locked->version + 1])->save();

            return $locked;
        });
    }

    public function publish(StoreDesign $design): StoreDesign
    {
        // The draft is checked again: a product or category it points to may be gone since.
        $clean = $this->validate($design->theme_key, $design->draft);
        $published = $clean;
        $published['sections'] = AiSectionDefinitions::stamp($clean['sections']);
        $design->forceFill(['draft' => $clean, 'published' => $published, 'published_at' => now()])->save();
        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $design;
    }

    /**
     * What the sections of a design show, keyed by section id.
     *
     * @param  array{settings: array<string, mixed>, sections: list<array<string, mixed>>}  $design
     * @return array<string, mixed>
     */
    public function data(array $design): array
    {
        $categories = $this->catalog->categoryRows();
        $bySlug = collect($categories)->keyBy('id');
        $products = [];
        $viewAll = [];
        $links = [];
        $tiles = [];
        $featured = [];
        $bundles = [];
        $mediaIds = array_filter([$design['settings']['logo_media_id'] ?? null, $design['settings']['logo_dark_media_id'] ?? null, $design['settings']['favicon_media_id'] ?? null]);
        $hideOutOfStock = ! ($design['settings']['general']['show_out_of_stock'] ?? true);
        $aiResolved = AiSectionDefinitions::resolve($design);

        foreach ($design['sections'] as $section) {
            $id = (string) $section['id'];
            $props = $section['props'];
            if ($section['type'] === 'ai') {
                $version = $aiResolved['byPlacement'][$id] ?? null;
                if ($version !== null) {
                    $values = is_array($props['values'] ?? null) ? $props['values'] : [];
                    foreach ((array) $version->fields as $field) {
                        if (! is_array($field) || ! isset($field['key'], $field['type'])) {
                            continue;
                        }
                        $key = (string) $field['key'];
                        $fType = (string) $field['type'];

                        if ($fType === 'products') {
                            $val = is_array($values[$key] ?? null) ? $values[$key] : null;
                            $source = is_string($val['source'] ?? null) ? $val['source'] : 'latest';
                            $limit = isset($val['limit']) ? (int) $val['limit'] : 8;
                            $catId = $val['category_id'] ?? null;
                            $prodIds = is_array($val['product_ids'] ?? null) ? array_values(array_map('intval', $val['product_ids'])) : [];

                            $products["{$id}:{$key}"] = $source === 'manual'
                                ? $this->catalog->cards($prodIds, $hideOutOfStock)
                                : $this->catalog->forSection($source, $catId, $limit, $hideOutOfStock);

                            $viewAll["{$id}:{$key}"] = match ($source) {
                                'offers' => '/offers',
                                'category' => ($c = $bySlug->get($catId)) ? '/categories/'.rawurlencode((string) $c['slug']) : null,
                                default => '/products',
                            };
                        } elseif ($fType === 'categories') {
                            $ids = is_array($values[$key]['category_ids'] ?? null)
                                ? array_values(array_map('intval', $values[$key]['category_ids']))
                                : [];
                            $tiles["{$id}:{$key}"] = $this->categoryTiles($categories, $ids);
                        } elseif ($fType === 'link') {
                            if (is_array($values[$key] ?? null) && isset($values[$key]['type'])) {
                                $links["{$id}:{$key}"] = $this->href($values[$key], $bySlug->all());
                            }
                        } elseif ($fType === 'image') {
                            if (isset($values["{$key}_media_id"])) {
                                $mediaIds[] = (int) $values["{$key}_media_id"];
                            }
                            $sampleMediaId = $field['sample_media_id'] ?? $field['sample'] ?? null;
                            if (is_int($sampleMediaId) && $sampleMediaId > 0) {
                                $mediaIds[] = $sampleMediaId;
                            }
                        } elseif ($fType === 'images') {
                            if (is_array($values["{$key}_media_ids"] ?? null)) {
                                array_push($mediaIds, ...array_map('intval', $values["{$key}_media_ids"]));
                            }
                        } elseif ($fType === 'list') {
                            $items = is_array($values[$key] ?? null) ? array_values($values[$key]) : [];
                            $subFields = is_array($field['fields'] ?? null) ? $field['fields'] : [];
                            foreach ($items as $itemIdx => $item) {
                                if (! is_array($item)) {
                                    continue;
                                }
                                foreach ($subFields as $sub) {
                                    if (! is_array($sub) || ! isset($sub['key'], $sub['type'])) {
                                        continue;
                                    }
                                    $subKey = (string) $sub['key'];
                                    $subType = (string) $sub['type'];
                                    if ($subType === 'link' && is_array($item[$subKey] ?? null) && isset($item[$subKey]['type'])) {
                                        $links["{$id}:{$key}:{$itemIdx}:{$subKey}"] = $this->href($item[$subKey], $bySlug->all());
                                    } elseif ($subType === 'image' && isset($item["{$subKey}_media_id"])) {
                                        $mediaIds[] = (int) $item["{$subKey}_media_id"];
                                    }
                                }
                            }
                        }
                    }
                }

                continue;
            }
            if ($section['type'] === 'products') {
                $products[$id] = $this->catalog->forSection((string) $props['source'], $props['category_id'] ?? null, (int) $props['limit'], ! ($design['settings']['general']['show_out_of_stock'] ?? true));
                $viewAll[$id] = match ($props['source']) {
                    'offers' => '/offers',
                    'category' => ($c = $bySlug->get($props['category_id'])) ? '/categories/'.rawurlencode((string) $c['slug']) : null,
                    default => '/products',
                };
            }
            if ($section['type'] === 'banner' || $section['type'] === 'hero') {
                foreach ($props['slides'] as $i => $slide) {
                    $mediaIds[] = $slide['media_id'];
                    $links["{$id}:{$i}"] = $this->href($slide['link'], $bySlug->all());
                }
            }
            // «صوفي»: items that carry an image and a link (banners, brands, gallery).
            if (in_array($section['type'], ['banners', 'brands', 'gallery'], true)) {
                foreach ($props['items'] as $i => $item) {
                    $mediaIds[] = $item['media_id'];
                    $links["{$id}:{$i}"] = $this->href($item['link'], $bySlug->all());
                }
            }
            if (in_array($section['type'], ['countdown', 'story'], true)) {
                $links[$id] = $this->href($props['link'], $bySlug->all());
            }
            array_push($mediaIds, ...array_filter([$props['media_id'] ?? null, $props['media2_id'] ?? null, $props['cover_media_id'] ?? null]));
            if ($section['type'] === 'product_tabs') {
                foreach ($props['tabs'] as $j => $tab) {
                    $products["{$id}:{$j}"] = $tab['source'] === 'manual'
                        ? $this->catalog->cards($tab['product_ids'], ! ($design['settings']['general']['show_out_of_stock'] ?? true))
                        : $this->catalog->forSection((string) $tab['source'], $tab['category_id'] ?? null, (int) $props['limit'], ! ($design['settings']['general']['show_out_of_stock'] ?? true));
                }
            }
            if ($section['type'] === 'categories') {
                $tiles[$id] = $this->categoryTiles($categories, $props['category_ids']);
            }
            if ($section['type'] === 'featured_product') {
                $featured[$id] = $this->featured((int) $props['product_id']);
            }
            // «شابع»: the hero's two buttons, and each pack card's offer with where it leads.
            if ($section['type'] === 'food_hero') {
                $links["{$id}:primary"] = $this->href($props['primary_link'], $bySlug->all());
                $links["{$id}:second"] = $this->href($props['second_link'], $bySlug->all());
            }
            if ($section['type'] === 'bundles') {
                array_push($mediaIds, ...array_filter(array_column($props['cards'], 'media_id')));
                $bundles[$id] = array_map(fn (array $card) => $this->bundle((int) $card['offer_id']), $props['cards']);
            }
        }
        // A header button with a link of its own («شابع»'s «اطلب دلوقتي»).
        if (isset($design['settings']['header']['button_link'])) {
            $links['header_button'] = $this->href($design['settings']['header']['button_link'], $bySlug->all());
        }
        // The cart's suggestions (a theme with «السلة» settings): the store's offers or newest products.
        $cart = $design['settings']['cart'] ?? null;
        $cartProducts = is_array($cart) && ($cart['suggestions_enabled'] ?? false)
            ? $this->catalog->forSection($cart['suggestions'] === 'latest' ? 'latest' : 'offers', null, 8, ! ($design['settings']['general']['show_out_of_stock'] ?? true))
            : [];
        if (isset($design['settings']['general']['offers_tab'])) {
            $links['offers_tab'] = $this->href($design['settings']['general']['offers_tab']['link'], $bySlug->all());
        }

        return [
            'products' => (object) $products,
            'view_all' => (object) $viewAll,
            'links' => (object) $links,
            'media' => (object) Media::query()->whereIn('id', array_unique(array_map('intval', $mediaIds)))->get()->mapWithKeys(fn (Media $m) => [$m->id => $m->urls()])->all(),
            // The header menu of «أساس»: the visible categories (custom menus come with paid themes).
            'categories' => array_values(array_map(fn (array $c) => ['id' => $c['id'], 'parent_id' => $c['parent_id'], 'name' => $c['name'], 'slug' => $c['slug']], array_filter($categories, fn (array $c) => $c['depth'] <= 1))),
            'pages' => StorePage::query()->where('is_published', true)->orderBy('position')->orderBy('id')->get(['title', 'slug'])->map(fn (StorePage $p) => ['title' => $p->title, 'slug' => $p->slug])->all(),
            // «آراء العملاء» set to automatic: the latest good reviews customers wrote on products.
            'reviews' => $this->reviews->forHome(),
            // «صوفي»: the category tiles and the featured product of their sections.
            'category_tiles' => (object) $tiles,
            'featured' => (object) $featured,
            'bundles' => (object) $bundles,
            'cart_products' => $cartProducts,
            'ai_sections' => (object) $aiResolved['definitions'],
            'ai_sections_current' => (object) $aiResolved['current'],
        ];
    }

    /**
     * The chosen categories in their order, or the top-level ones when none were chosen.
     *
     * @param  list<array<string, mixed>>  $rows
     * @param  list<int>  $ids
     * @return list<array<string, mixed>>
     */
    private function categoryTiles(array $rows, array $ids): array
    {
        $byId = collect($rows)->keyBy('id');
        $picked = $ids === []
            ? collect($rows)->where('depth', 0)->take(12)
            : collect($ids)->map(fn (int $i) => $byId->get($i))->filter();

        return $picked->map(fn (array $c) => ['id' => $c['id'], 'name' => $c['name'], 'slug' => $c['slug'], 'image' => $c['image'], 'products_count' => $c['products_count']])->values()->all();
    }

    /**
     * The featured product with what its add-to-cart needs, or null when it can't be bought now.
     *
     * @return array<string, mixed>|null
     */
    private function featured(int $productId): ?array
    {
        $product = $this->catalog->sellable()->with(['options.values', 'media', 'variants'])->whereKey($productId)->first();
        if ($product === null) {
            return null;
        }

        return [
            'product' => $this->pageData->product($product),
            'offers' => $this->pageData->offers($product, now()),
            'rating' => $this->reviews->summary($product->id),
        ];
    }

    /**
     * A pack card's offer as visitors see it, the product it is for (when it is for one product) and
     * where its button leads; null when the offer can't be offered now (stopped, ended, plan-locked).
     *
     * @return array{offer: array<string, mixed>, product: array<string, mixed>|null, href: string}|null
     */
    private function bundle(int $offerId): ?array
    {
        $now = now();
        $offer = Offer::query()->servable()->whereKey($offerId)
            ->where(fn ($q) => $q->where(fn ($active) => $active->activeAt($now))->orWhere(fn ($soon) => $soon->upcomingAt($now)))
            ->with('giftProduct')
            ->first();
        if ($offer === null) {
            return null;
        }
        $product = null;
        if ($offer->applies_to === PromotionTarget::Products) {
            $ids = $offer->products()->orderBy('offer_products.product_id')->pluck('products.id')->map(fn ($v) => (int) $v)->all();
            $product = $this->catalog->cards($ids)[0] ?? null;
        }

        return [
            'offer' => $this->pageData->offer($offer, $now),
            'product' => $product,
            'href' => $product === null ? '/offers' : '/products/'.rawurlencode((string) $product['slug']),
        ];
    }

    /**
     * @param  array{type: string, target_id: int|null, url: string|null}  $link
     * @param  array<int, array<string, mixed>>  $categories
     */
    private function href(array $link, array $categories): ?string
    {
        return match ($link['type']) {
            'all_products' => '/products',
            'offers' => '/offers',
            'category' => isset($categories[$link['target_id']]) ? '/categories/'.rawurlencode((string) $categories[$link['target_id']]['slug']) : null,
            'product' => ($slug = $this->catalog->sellable()->whereKey($link['target_id'])->value('slug')) ? '/products/'.rawurlencode((string) $slug) : null,
            'url' => $link['url'],
            default => null,
        };
    }
}
