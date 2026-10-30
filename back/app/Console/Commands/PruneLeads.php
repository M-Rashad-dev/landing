<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Actions\Orders\CaptureLead;
use App\Models\AbandonedLead;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;

/** Daily: abandoned order forms older than 30 days are deleted (visitors never submitted them). */
final class PruneLeads extends Command
{
    protected $signature = 'leads:prune';

    protected $description = 'Delete abandoned order forms older than 30 days';

    public function handle(): int
    {
        $cutoff = now()->subDays(CaptureLead::KEEP_DAYS);

        // Audited bypass: one cleanup across all tenants, only rows past the retention window.
        $deleted = Tenancy::withoutTenant(fn (): int => AbandonedLead::query()->where('created_at', '<', $cutoff)->delete());

        $this->info(sprintf('Deleted %d old leads.', $deleted));

        return self::SUCCESS;
    }
}
