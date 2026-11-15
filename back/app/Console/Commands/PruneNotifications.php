<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\UserNotification;
use Illuminate\Console\Command;

/** Daily: the bell keeps 90 days of read notifications and 180 days of unread ones. */
final class PruneNotifications extends Command
{
    protected $signature = 'notifications:prune';

    protected $description = 'Delete old bell notifications';

    public function handle(): int
    {
        $read = UserNotification::query()->whereNotNull('read_at')->where('created_at', '<', now()->subDays(90))->delete();
        $old = UserNotification::query()->where('created_at', '<', now()->subDays(180))->delete();

        $this->info('Deleted '.($read + $old).' notification(s).');

        return self::SUCCESS;
    }
}
