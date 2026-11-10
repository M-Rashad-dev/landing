<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Billing\Payments\Invoices;
use Illuminate\Console\Command;

/** Hourly: open invoices past their time are marked expired (a new one uses today's prices). */
final class ExpireInvoices extends Command
{
    protected $signature = 'invoices:expire';

    protected $description = 'Mark unpaid open invoices past their time as expired';

    public function handle(Invoices $invoices): int
    {
        $this->info('Expired '.$invoices->expireDue().' invoice(s).');

        return self::SUCCESS;
    }
}
