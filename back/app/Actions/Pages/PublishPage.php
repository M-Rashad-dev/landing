<?php

declare(strict_types=1);

namespace App\Actions\Pages;

use App\Billing\Themes\ThemeAccess;
use App\Enums\PageStatus;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\LandingPage;
use App\Models\Tenant;
use App\Models\Theme;
use App\Themes\LandingThemes;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Collects every blocker at once; when clean, copies the draft to published_content. */
final class PublishPage
{
    public function __construct(
        private readonly LandingThemes $themes,
        private readonly SyncPageMedia $syncMedia,
        private readonly EnsureHomePage $home,
    ) {}

    public function handle(LandingPage $page): LandingPage
    {
        $page->loadMissing(['product', 'identity']);
        $blockers = [];
        $clean = null;

        if ($page->isLockedByPlan()) {
            $blockers[] = $this->blocker('locked_by_plan');
        }

        if ($page->product_id === null) {
            $blockers[] = $this->blocker('no_product');
        } elseif ($page->product === null || $page->product->trashed() || ! $page->product->is_active) {
            $blockers[] = $this->blocker('product_inactive');
        } elseif ($page->product->isLockedByPlan()) {
            $blockers[] = $this->blocker('product_locked_by_plan');
        }

        if ($page->identity === null || $page->identity->trashed()) {
            $blockers[] = $this->blocker('identity_missing');
        }

        try {
            $clean = $this->themes->clean($page->theme_key, $page->draft_content, 'content', $page->kind);
        } catch (ValidationException $e) {
            $first = collect($e->errors())->flatten()->first();
            $blockers[] = $this->blocker('content_invalid', ['error' => (string) $first]);
        }

        $sections = $clean['sections'] ?? $page->draft_content['sections'] ?? [];
        $visible = array_values(array_filter($sections, fn ($s) => is_array($s) && ($s['visible'] ?? true) === true));
        $forms = count(array_filter($visible, fn ($s) => ($s['type'] ?? null) === 'order_form'));

        if ($forms === 0) {
            $blockers[] = $this->blocker('order_form_missing');
        } elseif ($forms > 1) {
            $blockers[] = $this->blocker('order_form_multiple');
        }

        // A disabled theme only stops new pages from choosing it; pages already on it keep publishing.
        if (! Theme::query()->where('key', $page->theme_key)->exists()) {
            $blockers[] = $this->blocker('theme_inactive');
        } elseif (! app(ThemeAccess::class)->canPublish(Tenant::query()->findOrFail($page->tenant_id), $page->theme_key)) {
            $blockers[] = $this->blocker('theme_not_available');
        }

        if ($visible === []) {
            $blockers[] = $this->blocker('no_visible_sections');
        }

        if ($blockers !== []) {
            throw new ApiException(422, 'publish_blocked', __('pages.publish_blocked'), null, ['blockers' => $blockers]);
        }

        DB::transaction(function () use ($page, $clean): void {
            $page->forceFill([
                'published_content' => array_merge($clean, ['theme_key' => $page->theme_key]),
                'status' => PageStatus::Published,
                'published_at' => now(),
            ])->save();

            $this->syncMedia->handle($page);
            $this->home->handle($page);
        });

        RevalidateTenantHosts::dispatch($page->tenant_id)->afterCommit();

        return $page;
    }

    /**
     * @param  array<string, string>  $replace
     * @return array{code: string, message: string}
     */
    private function blocker(string $code, array $replace = []): array
    {
        return ['code' => $code, 'message' => __('pages.blockers.'.$code, $replace)];
    }
}
