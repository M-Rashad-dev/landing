<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Tenant;
use App\Notifications\StoreNotices;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;

/**
 * Hourly: tells store owners their plan ends in 7, 3 or 1 day(s), and when it has ended.
 * Each reminder goes once per plan period (dedupe key = period end + days), so running
 * often only makes it timely. A renewed plan moves plan_ends_at and stops the reminders.
 */
final class SendPlanReminders extends Command
{
    private const DAYS = [7, 3, 1];

    protected $signature = 'notifications:plan-reminders';

    protected $description = 'Remind store owners before (and when) their plan ends';

    public function handle(StoreNotices $notices): int
    {
        $now = now();
        $sent = 0;

        // The tenants table is not tenant-scoped.
        Tenant::query()
            ->whereNotNull('plan_ends_at')
            ->whereBetween('plan_ends_at', [$now->copy()->subDays(2), $now->copy()->addDays(max(self::DAYS))])
            ->chunkById(200, function (Collection $tenants) use ($notices, $now, &$sent): void {
                foreach ($tenants as $tenant) {
                    /** @var Tenant $tenant */
                    $endsAt = $tenant->plan_ends_at;
                    if ($endsAt === null) {
                        continue;
                    }
                    if ($endsAt->lte($now)) {
                        $notices->planExpired($tenant, $endsAt);
                        $sent++;

                        continue;
                    }
                    $daysLeft = (int) ceil($now->diffInSeconds($endsAt) / 86400);
                    if (in_array($daysLeft, self::DAYS, true)) {
                        $notices->planExpiring($tenant, $daysLeft, $endsAt);
                        $sent++;
                    }
                }
            });

        $this->info("Checked plan reminders ({$sent} due).");

        return self::SUCCESS;
    }
}
