<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;

/** Daily: activity log lines older than 180 days go. */
final class PruneActivityLogs extends Command
{
    protected $signature = 'activity:prune';

    protected $description = 'Delete store activity log lines older than 180 days';

    public function handle(): int
    {
        // Audited bypass: one cleanup across all tenants, only old lines.
        $count = Tenancy::withoutTenant(fn (): int => ActivityLog::query()->where('created_at', '<', now()->subDays(ActivityLog::KEEP_DAYS))->delete());
        $this->info(sprintf('Pruned %d activity lines.', $count));

        return self::SUCCESS;
    }
}
