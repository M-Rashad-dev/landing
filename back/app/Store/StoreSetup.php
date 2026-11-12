<?php

declare(strict_types=1);

namespace App\Store;

use App\Billing\Entitlements;
use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Enums\PlanFeature;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Store;
use App\Models\Tenant;
use App\Store\Design\AsasDesign;
use App\Store\Design\StoreDesigner;
use Illuminate\Support\Facades\DB;

/**
 * The tenant's one store: created on first use with the design of its theme («أساس» by
 * default), turned on / off (needs the "store" plan feature), its theme and menus.
 */
final class StoreSetup
{
    public const DEFAULT_THEME = AsasDesign::KEY;

    public function __construct(
        private readonly Entitlements $entitlements,
        private readonly ThemeAccess $themes,
        private readonly ThemeCatalog $catalog,
        private readonly StoreDesigner $designer,
    ) {}

    /** The store row (null until the merchant prepares it). */
    public function current(): ?Store
    {
        return Store::query()->first();
    }

    /** Creates the store and the starter design of its theme once. */
    public function ensure(Tenant $tenant): Store
    {
        $this->entitlements->ensure(PlanFeature::Store);

        return DB::transaction(function (): Store {
            $store = Store::query()->lockForUpdate()->first()
                ?? Store::query()->create(['theme_key' => self::DEFAULT_THEME, 'is_enabled' => false, 'menus' => ['header' => [], 'footer' => []]]);
            $this->designer->for($store);

            return $store;
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
                throw new ApiException(422, 'validation_failed', __('design.theme_not_owned'), ['theme_key' => [__('design.theme_not_owned')]]);
            }
        }

        DB::transaction(function () use ($store, $data): void {
            $store->fill(array_intersect_key($data, array_flip(['is_enabled', 'theme_key', 'menus', 'seo'])))->save();
            $this->designer->for($store);
        });

        RevalidateTenantHosts::dispatch($tenant->id)->afterCommit();

        return $store->refresh();
    }

    /**
     * Serves "/" of the tenant: enabled, the plan has "store", its theme can be published and
     * its design is published.
     */
    public function isLive(Tenant $tenant, ?Store $store): bool
    {
        return $store !== null
            && $store->is_enabled
            && $this->entitlements->for($tenant)->allows(PlanFeature::Store)
            && $this->themes->canPublish($tenant, $store->theme_key)
            && $store->design()?->published !== null;
    }
}
