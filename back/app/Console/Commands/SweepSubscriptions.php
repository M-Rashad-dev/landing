<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Billing\SubscriptionManager;
use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Every minute: tenants whose plan state changes now (period end, grace end, a queued
 * period starts) are synced. Access itself is read from the dates, so a late run never
 * gives extra access; it only applies plan switches, locks and page purges.
 */
final class SweepSubscriptions extends Command
{
    protected $signature = 'subscriptions:sweep';

    protected $description = 'Apply plan period changes that are due (expiry, grace end, queued periods)';

    public function handle(SubscriptionManager $manager): int
    {
        $synced = 0;

        // The tenants table is not tenant-scoped; each sync runs inside its own tenant context.
        Tenant::query()
            ->whereNotNull('plan_next_check_at')
            ->where('plan_next_check_at', '<=', now())
            ->chunkById(200, function (Collection $tenants) use ($manager, &$synced): void {
                foreach ($tenants as $tenant) {
                    try {
                        $manager->sync($tenant);
                        $synced++;
                    } catch (Throwable $e) {
                        Log::error('subscription sweep failed', ['tenant_id' => $tenant->id, 'error' => $e->getMessage()]);
                    }
                }
            });

        $this->info("Synced {$synced} tenant(s).");

        return self::SUCCESS;
    }
}
