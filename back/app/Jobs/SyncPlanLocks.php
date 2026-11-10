<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Billing\PlanLocks;
use App\Models\Tenant;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;

/**
 * After the admin changes a plan's limits (or one store's override), re-applies plan locks
 * so stores over a lowered limit stop serving the extra rows and raised limits free them.
 */
final class SyncPlanLocks implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly ?string $planKey = null,
        public readonly ?int $tenantId = null,
    ) {}

    public function handle(PlanLocks $locks): void
    {
        // The tenants table is not tenant-scoped; PlanLocks runs inside each tenant's context.
        Tenant::query()
            ->when($this->tenantId !== null, fn ($q) => $q->whereKey($this->tenantId))
            ->when($this->planKey !== null, fn ($q) => $q->where('plan_key', $this->planKey))
            ->chunkById(200, fn (Collection $tenants) => $tenants->each(fn (Tenant $tenant) => $locks->sync($tenant)));
    }
}
