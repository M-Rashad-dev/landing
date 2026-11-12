<?php

declare(strict_types=1);

namespace App\Store\Design;

use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Store;
use App\Models\StoreDesign;
use App\Models\StorePage;
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
        private readonly AsasDesign $asas,
        private readonly StoreCatalog $catalog,
    ) {}

    public function for(Store $store): StoreDesign
    {
        $design = $store->design();
        if ($design !== null) {
            return $design;
        }
        $logo = Identity::query()->where('is_default', true)->value('logo_media_id');

        return StoreDesign::query()->firstOrCreate(
            ['theme_key' => $store->theme_key],
            ['draft' => AsasDesign::defaults($logo === null ? null : (int) $logo), 'version' => 1],
        );
    }

    /** @param mixed $draft what the Builder sent */
    public function save(StoreDesign $design, mixed $draft, int $version): StoreDesign
    {
        $clean = $this->asas->validate($draft);

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
        $clean = $this->asas->validate($design->draft);
        $design->forceFill(['draft' => $clean, 'published' => $clean, 'published_at' => now()])->save();
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
        $mediaIds = array_filter([$design['settings']['logo_media_id'] ?? null, $design['settings']['favicon_media_id'] ?? null]);

        foreach ($design['sections'] as $section) {
            $id = (string) $section['id'];
            $props = $section['props'];
            if ($section['type'] === 'products') {
                $products[$id] = $this->catalog->forSection((string) $props['source'], $props['category_id'] ?? null, (int) $props['limit']);
                $viewAll[$id] = match ($props['source']) {
                    'offers' => '/offers',
                    'category' => ($c = $bySlug->get($props['category_id'])) ? '/categories/'.rawurlencode((string) $c['slug']) : null,
                    default => '/products',
                };
            }
            if ($section['type'] === 'banner') {
                foreach ($props['slides'] as $i => $slide) {
                    $mediaIds[] = $slide['media_id'];
                    $links["{$id}:{$i}"] = $this->href($slide['link'], $bySlug->all());
                }
            }
        }

        return [
            'products' => (object) $products,
            'view_all' => (object) $viewAll,
            'links' => (object) $links,
            'media' => (object) Media::query()->whereIn('id', array_unique(array_map('intval', $mediaIds)))->get()->mapWithKeys(fn (Media $m) => [$m->id => $m->urls()])->all(),
            // The header menu of «أساس»: the visible categories (custom menus come with paid themes).
            'categories' => array_values(array_map(fn (array $c) => ['id' => $c['id'], 'parent_id' => $c['parent_id'], 'name' => $c['name'], 'slug' => $c['slug']], array_filter($categories, fn (array $c) => $c['depth'] <= 1))),
            'pages' => StorePage::query()->where('is_published', true)->orderBy('position')->orderBy('id')->get(['title', 'slug'])->map(fn (StorePage $p) => ['title' => $p->title, 'slug' => $p->slug])->all(),
            // Owner decision: fixed reviews for «تلقائي» until real reviews exist (phase 3, before launch).
            'reviews' => (array) __('design.auto_reviews'),
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
