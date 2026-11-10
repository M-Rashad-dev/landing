<?php

declare(strict_types=1);

namespace App\Billing\Themes;

use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Models\Tenant;
use App\Models\ThemePurchase;
use App\Support\Money;
use App\Tenancy\Tenancy;

/**
 * Which themes a store may use.
 *  - owns: free, bought or given by the admin → open it and customize it in the Builder.
 *  - canPublish: owns it, and a paid theme needs a plan with "buy_themes" → shown to visitors.
 * A paid theme stays owned forever; on a plan without the feature its pages stop serving
 * (after the grace hours, like every other feature) and come back with the upgrade.
 */
final class ThemeAccess
{
    /** @var array<int, list<string>> purchased keys per tenant (per request) */
    private array $purchased = [];

    public function __construct(
        private readonly ThemeCatalog $catalog,
        private readonly Entitlements $entitlements,
    ) {}

    public function owns(Tenant $tenant, string $key): bool
    {
        $theme = $this->catalog->theme($key);
        if ($theme === null) {
            return false;
        }

        return $theme['price_cents'] === 0 || in_array($key, $this->purchasedKeys($tenant->id), true);
    }

    public function canPublish(Tenant $tenant, string $key): bool
    {
        if (! $this->owns($tenant, $key)) {
            return false;
        }

        $plan = $this->entitlements->for($tenant);
        if (($this->catalog->theme($key)['kind'] ?? 'landing') === 'store' && ! $plan->allows(PlanFeature::Store)) {
            return false;
        }

        return $this->catalog->isFree($key) || $plan->allows(PlanFeature::BuyThemes);
    }

    /** @return list<string> */
    public function purchasedKeys(int $tenantId): array
    {
        return $this->purchased[$tenantId] ??= Tenancy::runAs($tenantId, fn (): array => ThemePurchase::query()->pluck('theme_key')->all());
    }

    public function grant(Tenant $tenant, string $key, string $source, ?int $invoiceId, int $paidCents, ?string $note = null, ?int $by = null): ThemePurchase
    {
        return Tenancy::runAs($tenant->id, fn (): ThemePurchase => ThemePurchase::query()->firstOrCreate(
            ['theme_key' => $key],
            ['source' => $source, 'invoice_id' => $invoiceId, 'price_paid' => Money::toDecimal($paidCents), 'note' => $note, 'created_by' => $by],
        ));
    }

    public static function forget(int $tenantId): void
    {
        if (app()->resolved(self::class)) {
            unset(app(self::class)->purchased[$tenantId]);
        }
    }
}
