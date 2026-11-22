<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Store\CustomerUploads;
use Illuminate\Console\Command;

/** Daily: images / files customers uploaded on «حسب الطلب» fields that no order took within a day are deleted. */
final class PruneCustomerUploads extends Command
{
    protected $signature = 'uploads:prune';

    protected $description = 'Delete customer uploads no order claimed within a day';

    public function handle(CustomerUploads $uploads): int
    {
        $this->info(sprintf('Pruned %d customer uploads.', $uploads->prune()));

        return self::SUCCESS;
    }
}
