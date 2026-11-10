<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\DomainType;
use App\Enums\PlanLimit;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Domain;
use App\Models\Tenant;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * After a plan change, rows above a limit are kept but stop serving (locked_by_plan = true).
 * Rows the merchant already kept active stay active first, then the most recently edited.
 * Nothing is deleted, and the merchant's own status (published, active…) is never touched,
 * so an upgrade brings everything back exactly as it was.
 */
final class PlanLocks
{
    public function __construct(
        private readonly Entitlements $entitlements,
        private readonly UsageCounter $usage,
    ) {}

    /** @return bool whether any row changed */
    public function sync(Tenant $tenant): bool
    {
        // An expired tenant serves nothing anyway; keep its choices for when it pays again.
        if (! $tenant->accessState()->isOpen()) {
            return false;
        }

        $entitlements = $this->entitlements->for($tenant);

        $changed = Tenancy::runAs($tenant->id, fn (): bool => DB::transaction(function () use ($entitlements): bool {
            $changed = false;
            foreach ($this->lockableLimits() as $limit) {
                $keep = $this->usage->rows($limit)
                    ->orderBy('locked_by_plan')
                    ->orderByDesc('updated_at')
                    ->orderByDesc('id')
                    ->limit($entitlements->limit($limit))
                    ->pluck('id')
                    ->all();

                $changed = $this->apply($limit, $keep) || $changed;
            }

            return $changed;
        }));

        if ($changed) {
            $this->afterChange($tenant->id);
        }

        return $changed;
    }

    /**
     * The merchant picks which rows of one limit stay active (at most the limit).
     *
     * @param  list<int>  $activeIds
     */
    public function choose(Tenant $tenant, PlanLimit $limit, array $activeIds): void
    {
        $max = $this->entitlements->for($tenant)->limit($limit);
        $activeIds = array_values(array_unique($activeIds));

        if (count($activeIds) > $max) {
            throw new ApiException(422, 'lock_too_many', __('billing.lock_too_many', ['limit' => $max]));
        }

        $changed = Tenancy::runAs($tenant->id, function () use ($limit, $activeIds): bool {
            // Tenant scope applies: ids of other tenants (or other row kinds) are simply not found.
            $known = $this->usage->rows($limit)->whereKey($activeIds)->pluck('id')->all();
            if (count($known) !== count($activeIds)) {
                throw new ApiException(404, 'not_found', __('landing.not_found'));
            }

            return DB::transaction(fn (): bool => $this->apply($limit, $known));
        });

        if ($changed) {
            $this->afterChange($tenant->id);
        }
    }

    /** @return list<PlanLimit> */
    public function lockableLimits(): array
    {
        return array_values(array_filter(PlanLimit::cases(), fn (PlanLimit $l) => $l->locksRows()));
    }

    /** @param list<int> $keep */
    private function apply(PlanLimit $limit, array $keep): bool
    {
        // toBase(): a plain update that keeps updated_at (it orders the next sync).
        $locked = $this->usage->rows($limit)->where('locked_by_plan', false)
            ->when($keep !== [], fn ($q) => $q->whereKeyNot($keep))
            ->toBase()->update(['locked_by_plan' => true]);

        $unlocked = $keep === [] ? 0 : $this->usage->rows($limit)->where('locked_by_plan', true)
            ->whereKey($keep)
            ->toBase()->update(['locked_by_plan' => false]);

        if ($limit === PlanLimit::CustomDomains && $locked > 0) {
            // A locked custom domain can't stay primary: the free subdomain takes over.
            $lockedPrimary = Domain::query()->where('type', DomainType::Custom)->where('locked_by_plan', true)->where('is_primary', true)->toBase()->update(['is_primary' => false]);
            if ($lockedPrimary > 0) {
                Domain::query()->where('type', DomainType::Subdomain)->toBase()->update(['is_primary' => true]);
            }
        }

        return $locked + $unlocked > 0;
    }

    /** Bulk updates fire no model events: drop cached host lookups and purge Next's cache. */
    private function afterChange(int $tenantId): void
    {
        // Audited bypass: explicitly filtered to this tenant's id.
        $hosts = Tenancy::withoutTenant(fn () => Domain::query()->where('tenant_id', $tenantId)->get(['host', 'active_host']))
            ->flatMap(fn (Domain $d) => [$d->host, $d->active_host])
            ->filter()
            ->unique()
            ->values()
            ->all();

        PublicSite::forget($hosts, $tenantId);
        RevalidateTenantHosts::dispatch($tenantId, $hosts);
    }
}
