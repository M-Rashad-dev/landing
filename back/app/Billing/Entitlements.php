<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\AccessState;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Enums\SubscriptionSource;
use App\Exceptions\ApiException;
use App\Models\EntitlementOverride;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * The only place that answers "may this tenant do X?" and "how many Y may it have?".
 * Plan values come from the cached catalog, admin overrides win over them, and the
 * platform safety caps sit above everything. Checks always happen in the back end.
 */
final class Entitlements
{
    private const OVERRIDES_TTL = 3600;

    /** @var array<int, TenantEntitlements> */
    private array $memo = [];

    /** @var array<int, Tenant> */
    private array $tenants = [];

    public function __construct(
        private readonly PlanCatalog $catalog,
        private readonly UsageCounter $usage,
    ) {}

    public function for(Tenant $tenant): TenantEntitlements
    {
        return $this->memo[$tenant->id] ??= $this->resolve($tenant);
    }

    /** Entitlements of the tenant in the current context (dashboard request, job, public request). */
    public function current(): TenantEntitlements
    {
        return $this->for($this->currentTenant());
    }

    public function allows(PlanFeature $feature): bool
    {
        return $this->current()->allows($feature);
    }

    /** @throws ApiException 403 plan_feature_locked */
    public function ensure(PlanFeature $feature): void
    {
        if (! $this->allows($feature)) {
            throw ApiException::planFeatureLocked($feature, $this->catalog->cheapestWithFeature($feature));
        }
    }

    /**
     * Throws when adding $adding more rows would pass the limit. Call it inside the write's
     * transaction (after locking the tenant row) when exact counting matters.
     *
     * @throws ApiException 403 plan_limit_reached
     */
    public function ensureCanAdd(PlanLimit $limit, int $adding = 1): void
    {
        $max = $this->current()->limit($limit);
        $used = $this->usage->used($limit);

        if ($used + $adding > $max) {
            throw ApiException::planLimitReached($limit, $max, $used, $this->catalog->cheapestAbove($limit, $max));
        }
    }

    /** @throws ApiException 403 plan_limit_reached when the upload would pass the storage limit */
    public function ensureStorageFor(int $bytes): void
    {
        $maxMb = $this->current()->limit(PlanLimit::MediaStorageMb);
        $usedBytes = $this->usage->mediaBytes();

        if ($usedBytes + $bytes > $maxMb * 1048576) {
            throw ApiException::planLimitReached(
                PlanLimit::MediaStorageMb,
                $maxMb,
                (int) ceil($usedBytes / 1048576),
                $this->catalog->cheapestAbove(PlanLimit::MediaStorageMb, $maxMb),
            );
        }
    }

    /** Drops the cached overrides and the in-request copy of one tenant. */
    public static function forget(int $tenantId): void
    {
        Cache::forget(self::overridesKey($tenantId));

        if (app()->resolved(self::class)) {
            $self = app(self::class);
            unset($self->memo[$tenantId], $self->tenants[$tenantId]);
        }
    }

    private function resolve(Tenant $tenant): TenantEntitlements
    {
        $state = $tenant->accessState();
        $plan = $this->catalog->plan($tenant->plan_key);
        $values = $plan['values'] ?? [];

        foreach ($this->overrides($tenant->id) as $entitlement => $value) {
            $values[$entitlement] = $value;
        }

        $features = [];
        foreach (PlanFeature::cases() as $feature) {
            $features[$feature->value] = ($values[$feature->value] ?? 0) > 0;
        }

        $limits = [];
        foreach (PlanLimit::cases() as $limit) {
            // Missing value = 0 (closed); a stored null = unlimited.
            $limits[$limit->value] = array_key_exists($limit->value, $values) ? $values[$limit->value] : 0;
        }

        return new TenantEntitlements(
            tenantId: $tenant->id,
            state: $plan === null ? AccessState::Expired : $state,
            planKey: $tenant->plan_key,
            planName: $plan['name'] ?? null,
            period: $tenant->plan_period,
            endsAt: $tenant->plan_ends_at === null ? null : CarbonImmutable::instance($tenant->plan_ends_at),
            graceEndsAt: $tenant->plan_grace_ends_at === null ? null : CarbonImmutable::instance($tenant->plan_grace_ends_at),
            isTrial: $tenant->plan_source === SubscriptionSource::Trial,
            features: $features,
            limits: $limits,
        );
    }

    /** @return array<string, int|null> active overrides by entitlement */
    private function overrides(int $tenantId): array
    {
        $rows = Cache::remember(self::overridesKey($tenantId), self::OVERRIDES_TTL, fn (): array => Tenancy::runAs(
            $tenantId,
            fn () => EntitlementOverride::query()
                ->get(['entitlement', 'value', 'expires_at'])
                ->map(fn (EntitlementOverride $o) => ['entitlement' => $o->entitlement, 'value' => $o->value, 'expires_at' => $o->expires_at?->getTimestamp()])
                ->all(),
        ));

        $now = now()->getTimestamp();
        $active = [];
        foreach ($rows as $row) {
            if ($row['expires_at'] === null || $row['expires_at'] > $now) {
                $active[$row['entitlement']] = $row['value'];
            }
        }

        return $active;
    }

    private function currentTenant(): Tenant
    {
        $id = Tenancy::id() ?? throw ApiException::forbidden();

        // Dashboard requests already loaded the user's tenant.
        $user = auth()->user();
        if ($user instanceof User && $user->tenant_id === $id && $user->relationLoaded('tenant') && $user->tenant !== null) {
            return $user->tenant;
        }

        return $this->tenants[$id] ??= Tenant::query()->findOrFail($id);
    }

    private static function overridesKey(int $tenantId): string
    {
        return 'billing:overrides:'.$tenantId;
    }
}
