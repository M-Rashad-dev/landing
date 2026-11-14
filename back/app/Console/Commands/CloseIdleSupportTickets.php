<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\Support\SupportDesk;
use Illuminate\Console\Command;

/** Every few minutes: support conversations waiting for the merchant past the idle hours are closed. */
final class CloseIdleSupportTickets extends Command
{
    protected $signature = 'support:close-idle';

    protected $description = 'Close support conversations the merchant left without a reply';

    public function handle(SupportDesk $desk): int
    {
        $this->info(sprintf('Closed %d idle conversations.', $desk->closeIdle()));

        return self::SUCCESS;
    }
}
