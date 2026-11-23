<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Orders\WhatsAppConfirmations;
use Illuminate\Console\Command;

/** Every 10 minutes: WhatsApp confirmation reminders, and «ماردّش» (or a cancel) once the store's wait is over. */
final class FollowUpConfirmations extends Command
{
    protected $signature = 'orders:confirmations';

    protected $description = 'Remind customers who did not answer the WhatsApp order confirmation, and close the ones past the wait';

    public function handle(WhatsAppConfirmations $confirmations): int
    {
        $done = $confirmations->followUp();
        $this->info(sprintf('Reminded %d, closed %d.', $done['reminded'], $done['closed']));

        return self::SUCCESS;
    }
}
