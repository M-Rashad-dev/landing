<?php

declare(strict_types=1);

namespace App\Actions\Pages;

use App\Billing\Entitlements;
use App\Enums\PageStatus;
use App\Enums\PlanLimit;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\LandingPage;
use Illuminate\Support\Facades\DB;

/** Unpublish, duplicate, set-home and delete. */
final class PageLifecycle
{
    public function __construct(
        private readonly SyncPageMedia $syncMedia,
        private readonly EnsureHomePage $home = new EnsureHomePage,
    ) {}

    public function unpublish(LandingPage $page): LandingPage
    {
        $page->forceFill([
            'status' => PageStatus::Draft,
            'published_content' => null,
            'published_at' => null,
            // An unpublished page cannot stay the home page.
            'is_home' => false,
            'home_key' => null,
        ])->save();

        $this->syncMedia->handle($page);
        $this->home->handle();
        RevalidateTenantHosts::dispatch($page->tenant_id)->afterCommit();

        return $page;
    }

    public function duplicate(LandingPage $page, ?int $userId): LandingPage
    {
        app(Entitlements::class)->ensureCanAdd(PlanLimit::LandingPages);

        return DB::transaction(function () use ($page, $userId): LandingPage {
            $suffix = __('pages.copy_suffix');
            $copy = LandingPage::create([
                'title' => mb_substr($page->title, 0, 120 - mb_strlen($suffix)).$suffix,
                'slug' => $this->freeSlug(mb_substr($page->slug, 0, 52).'-copy'),
                'status' => PageStatus::Draft,
                'theme_key' => $page->theme_key,
                'identity_id' => $page->identity_id,
                'product_id' => $page->product_id,
                'draft_content' => $page->draft_content,
                'version' => 1,
                'is_home' => false,
                'seo_override' => $page->seo_override,
                'created_by' => $userId,
            ]);

            $this->syncMedia->handle($copy);

            return $copy;
        });
    }

    public function setHome(LandingPage $page): LandingPage
    {
        if (! $page->isPublished()) {
            throw new ApiException(422, 'validation_failed', __('pages.home_requires_published'), ['page' => [__('pages.home_requires_published')]]);
        }

        DB::transaction(function () use ($page): void {
            LandingPage::query()->where('id', '!=', $page->id)->where('is_home', true)->update(['is_home' => false, 'home_key' => null]);
            $page->forceFill(['is_home' => true, 'home_key' => 1])->save();
        });

        RevalidateTenantHosts::dispatch($page->tenant_id)->afterCommit();

        return $page;
    }

    public function delete(LandingPage $page): void
    {
        $wasPublished = $page->isPublished();

        DB::transaction(function () use ($page): void {
            $page->forceFill([
                'slug' => mb_substr($page->slug, 0, 90).'--deleted-'.$page->id,
                'is_home' => false,
                'home_key' => null,
            ])->save();
            $page->delete();
            DB::table('landing_page_media')->where('landing_page_id', $page->id)->delete();
            $this->home->handle();
        });

        if ($wasPublished) {
            RevalidateTenantHosts::dispatch($page->tenant_id)->afterCommit();
        }
    }

    private function freeSlug(string $base): string
    {
        $slug = $base;
        $n = 2;
        while (LandingPage::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$n++;
        }

        return $slug;
    }
}
