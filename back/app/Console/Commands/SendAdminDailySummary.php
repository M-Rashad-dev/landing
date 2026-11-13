<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Enums\AdminAlert;
use App\Services\AdminAlerts;
use App\Services\PlatformStats;
use App\Support\CairoTime;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;

/** Every morning (Cairo): yesterday's numbers and what waits for the owner, by email. */
final class SendAdminDailySummary extends Command
{
    protected $signature = 'admin:daily-summary';

    protected $description = 'Email the platform owner a summary of yesterday';

    public function handle(AdminAlerts $alerts, PlatformStats $stats): int
    {
        if (! $alerts->wants(AdminAlert::DailySummary)) {
            $this->info('Daily summary is off (or no alert email).');

            return self::SUCCESS;
        }

        $yesterday = CarbonImmutable::now(CairoTime::ZONE)->subDay()->startOfDay();
        $alerts->dailySummary($yesterday, $stats->day($yesterday));
        $this->info('Daily summary queued.');

        return self::SUCCESS;
    }
}
