<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Jobs\VerifyDomain;
use App\Models\Domain;
use App\Tenancy\Tenancy;
use Illuminate\Console\Command;

/** Every 5 minutes: re-check pending custom domains younger than 72 h; older ones become failed. */
final class VerifyPendingDomains extends Command
{
    public const MAX_AGE_HOURS = 72;

    public const BATCH = 100;

    protected $signature = 'domains:verify-pending';

    protected $description = 'Re-check DNS of pending custom domains and fail the expired ones';

    public function handle(): int
    {
        $cutoff = now()->subHours(self::MAX_AGE_HOURS);

        // Audited bypass: the scheduler works across tenants; each VerifyDomain job then runs inside its domain's tenant.
        [$failed, $ids] = Tenancy::withoutTenant(function () use ($cutoff): array {
            $pending = fn () => Domain::query()->where('type', DomainType::Custom)->where('status', DomainStatus::Pending);

            $failed = $pending()->where('created_at', '<', $cutoff)->update(['status' => DomainStatus::Failed, 'updated_at' => now()]);
            $ids = $pending()
                ->where('created_at', '>=', $cutoff)
                ->orderByRaw('last_checked_at is not null')
                ->orderBy('last_checked_at')
                ->limit(self::BATCH)
                ->pluck('id')
                ->all();

            return [$failed, $ids];
        });

        foreach ($ids as $id) {
            VerifyDomain::dispatch((int) $id);
        }

        $this->info(sprintf('Queued %d checks, %d expired.', count($ids), $failed));

        return self::SUCCESS;
    }
}
