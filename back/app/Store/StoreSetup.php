<?php

declare(strict_types=1);

namespace App\Store;

use App\Billing\Entitlements;
use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Enums\PageStatus;
use App\Enums\PlanFeature;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Store;
use App\Models\Tenant;
use App\Services\PageContentSanitizer;
use App\Support\Slugs;
use Illuminate\Support\Facades\DB;

/**
 * The tenant's one store: created on first use with its home page (a store_home page in the
 * Builder), turned on / off (needs the "store" plan feature), its theme, settings and menus.
 */
final class StoreSetup
{
    public const DEFAULT_THEME = 'rewaq';

    public function __construct(
        private readonly Entitlements $entitlements,
        private readonly ThemeAccess $themes,
        private readonly ThemeCatalog $catalog,
        private readonly PageContentSanitizer $sanitizer,
    ) {}

    /** The store row (null until the merchant opens «المتجر» for the first time). */
    public function current(): ?Store
    {
        return Store::query()->with('homePage')->first();
    }

    /**
     * Creates the store and its home page once. $starter is the Builder starter content the
     * dashboard sends (store sections of the theme), sanitized like any Builder save.
     */
    public function ensure(Tenant $tenant, mixed $starter = null): Store
    {
        $this->entitlements->ensure(PlanFeature::Store);

        return DB::transaction(function () use ($starter): Store {
            $store = Store::query()->lockForUpdate()->first()
                ?? Store::query()->create(['theme_key' => self::DEFAULT_THEME, 'is_enabled' => false, 'menus' => ['header' => [], 'footer' => []]]);

            if ($store->home_page_id === null || LandingPage::query()->find($store->home_page_id) === null) {
                $content = $starter === null
                    ? ['version' => 1, 'sections' => []]
                    : $this->sanitizer->sanitize($starter, 'content', LandingPage::KIND_STORE_HOME)['content'];

                $home = LandingPage::query()->create([
                    'kind' => LandingPage::KIND_STORE_HOME,
                    'title' => __('store.home_title'),
                    'slug' => Slugs::unique(LandingPage::query()->withTrashed(), 'store-home'),
                    'status' => PageStatus::Draft,
                    'theme_key' => $store->theme_key,
                    'identity_id' => Identity::query()->where('is_default', true)->value('id') ?? Identity::query()->value('id'),
                    'draft_content' => $content,
                    'version' => 1,
                    'created_by' => auth()->id(),
                ]);
                $store->forceFill(['home_page_id' => $home->id])->save();
            }

            return $store->load('homePage');
        });
    }

    /** @param array<string, mixed> $data validated StoreRequest data */
    public function update(Tenant $tenant, Store $store, array $data): Store
    {
        if (array_key_exists('is_enabled', $data) && (bool) $data['is_enabled']) {
            $this->entitlements->ensure(PlanFeature::Store);
        }

        if (isset($data['theme_key']) && $data['theme_key'] !== $store->theme_key) {
            $theme = $this->catalog->theme($data['theme_key']);
            if ($theme === null || $theme['kind'] !== 'store' || ! $theme['is_active'] || ! $this->themes->owns($tenant, $data['theme_key'])) {
                throw new ApiException(422, 'validation_failed', __('pages.theme_wrong_kind'), ['theme_key' => [__('pages.theme_not_owned')]]);
            }
        }

        DB::transaction(function () use ($store, $data): void {
            $store->fill(array_intersect_key($data, array_flip(['is_enabled', 'theme_key', 'menus', 'seo'])));
            if (array_key_exists('settings', $data)) {
                $store->settings = array_intersect_key((array) $data['settings'], Store::DEFAULT_SETTINGS);
            }
            $store->save();

            // The home follows the store theme (its sections are the same in every store theme).
            if ($store->wasChanged('theme_key') && $store->home_page_id !== null) {
                LandingPage::query()->whereKey($store->home_page_id)->update(['theme_key' => $store->theme_key]);
            }
        });

        RevalidateTenantHosts::dispatch($tenant->id)->afterCommit();

        return $store->refresh()->load('homePage');
    }

    /**
     * Serves "/" of the tenant: enabled, the plan has "store", its theme can be published and
     * its home is published.
     */
    public function isLive(Tenant $tenant, ?Store $store): bool
    {
        return $store !== null
            && $store->is_enabled
            && $this->entitlements->for($tenant)->allows(PlanFeature::Store)
            && $this->themes->canPublish($tenant, $store->theme_key);
    }
}
