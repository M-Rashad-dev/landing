<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\CopilotChangeSet;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;

/** Hourly: copilot proposals nobody pressed «نفّذ» on within 24 hours expire (nothing in the store changes). */
final class ExpireCopilotChanges extends Command
{
    protected $signature = 'copilot:expire';

    protected $description = 'Expire the store copilot\'s proposals older than 24 hours';

    public function handle(): int
    {
        // Audited bypass: one sweep across all tenants, only proposals past their expiry.
        $count = Tenancy::withoutTenant(fn (): int => CopilotChangeSet::query()
            ->whereIn('status', [CopilotChangeSet::STATUS_PROPOSED, CopilotChangeSet::STATUS_ESTIMATE])
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->update(['status' => CopilotChangeSet::STATUS_EXPIRED]));

        $this->info(sprintf('Expired %d copilot proposals.', $count));

        return self::SUCCESS;
    }
}
