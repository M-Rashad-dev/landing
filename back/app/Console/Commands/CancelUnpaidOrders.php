<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Store\Payments\StorePayments;
use Illuminate\Console\Command;

/** Hourly: prepaid orders left unpaid past the store's days (no receipt waiting) are cancelled, their stock back. */
final class CancelUnpaidOrders extends Command
{
    protected $signature = 'orders:cancel-unpaid';

    protected $description = 'Cancel prepaid orders nobody paid in time';

    public function handle(StorePayments $payments): int
    {
        $this->info(sprintf('Cancelled %d unpaid orders.', $payments->cancelUnpaid()));

        return self::SUCCESS;
    }
}
