<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

/**
 * Where a media item is referenced (all queries run inside the media's tenant).
 * Each usage: {type, id, name}.
 */
final class MediaUsageFinder
{
    /** @return list<array{type: string, id: int, name: string}> */
    public function find(Media $media): array
    {
        return array_merge(
            $this->identities($media),
            $this->products($media),
            $this->pages($media),
        );
    }

    /** Pages whose content or SEO image uses the media (landing_page_media is kept in sync on every save). */
    private function pages(Media $media): array
    {
        $pages = LandingPage::query()
            ->whereIn('id', DB::table('landing_page_media')->where('media_id', $media->id)->select('landing_page_id'))
            ->get(['id', 'title', 'seo_override']);

        return $pages->map(fn (LandingPage $page) => [
            'type' => ($page->seo_override['og_media_id'] ?? null) === $media->id ? 'page_og' : 'page',
            'id' => $page->id,
            'name' => $page->title,
        ])->all();
    }

    /** @return list<array{type: string, id: int, name: string}> */
    private function products(Media $media): array
    {
        return Product::query()
            ->whereIn('id', DB::table('product_media')->where('media_id', $media->id)->select('product_id'))
            ->get(['id', 'name'])
            ->map(fn (Product $product) => ['type' => 'product', 'id' => $product->id, 'name' => $product->name])
            ->all();
    }

    /** @return list<array{type: string, id: int, name: string}> */
    private function identities(Media $media): array
    {
        $usages = [];

        $identities = Identity::query()
            ->where(fn ($q) => $q
                ->where('logo_media_id', $media->id)
                ->orWhere('favicon_media_id', $media->id)
                ->orWhere('og_image_media_id', $media->id))
            ->get(['id', 'name', 'logo_media_id', 'favicon_media_id', 'og_image_media_id']);

        foreach ($identities as $identity) {
            $roles = array_filter([
                $identity->logo_media_id === $media->id ? 'identity_logo' : null,
                $identity->favicon_media_id === $media->id ? 'identity_favicon' : null,
                $identity->og_image_media_id === $media->id ? 'identity_og' : null,
            ]);

            foreach ($roles as $role) {
                $usages[] = ['type' => $role, 'id' => $identity->id, 'name' => $identity->name];
            }
        }

        return $usages;
    }
}
