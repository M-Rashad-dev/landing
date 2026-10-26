<?php

declare(strict_types=1);

namespace App\Actions\Pages;

use App\Models\LandingPage;
use App\Support\ContentMedia;
use Illuminate\Support\Facades\DB;

/**
 * Keeps landing_page_media in sync with every image a page references
 * (draft, published content and the SEO image), so media deletion can detect usage.
 */
final class SyncPageMedia
{
    public function handle(LandingPage $page): void
    {
        $ids = array_merge(
            ContentMedia::extract($page->draft_content),
            ContentMedia::extract($page->published_content),
        );

        $og = $page->seo_override['og_media_id'] ?? null;
        if (is_int($og)) {
            $ids[] = $og;
        }

        $ids = array_values(array_unique($ids));
        // Only ids that still exist in this tenant (FK safety).
        $ids = DB::table('media')->where('tenant_id', $page->tenant_id)->whereIn('id', $ids)->pluck('id')->all();

        DB::table('landing_page_media')->where('landing_page_id', $page->id)->whereNotIn('media_id', $ids === [] ? [0] : $ids)->delete();

        $existing = DB::table('landing_page_media')->where('landing_page_id', $page->id)->pluck('media_id')->all();
        $now = now();
        $rows = [];
        foreach (array_diff($ids, $existing) as $mediaId) {
            $rows[] = ['tenant_id' => $page->tenant_id, 'landing_page_id' => $page->id, 'media_id' => $mediaId, 'created_at' => $now, 'updated_at' => $now];
        }

        if ($rows !== []) {
            DB::table('landing_page_media')->insert($rows);
        }
    }
}
