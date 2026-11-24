<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Recovery\CartRecovery;
use Illuminate\Console\Command;

/** Every 5 minutes: the abandoned cart reminders that are due, in every store that turned them on (quiet at night). */
final class SendCartReminders extends Command
{
    protected $signature = 'leads:remind';

    protected $description = 'Send the abandoned cart reminders that are due (WhatsApp from the message balance, and email)';

    public function handle(CartRecovery $recovery): int
    {
        $this->info(sprintf('Sent %d reminders.', $recovery->run()));

        return self::SUCCESS;
    }
}
