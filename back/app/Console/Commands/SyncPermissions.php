<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Auth\PermissionCatalog;
use Illuminate\Console\Command;

/** After a deploy: the permission list matches App\Auth\PermissionCatalog (new pages / actions appear for the owner to give). */
final class SyncPermissions extends Command
{
    protected $signature = 'permissions:sync';

    protected $description = 'Create the staff permissions the catalog lists (and drop the ones it no longer has)';

    public function handle(): int
    {
        $this->info(sprintf('Created %d permissions.', PermissionCatalog::sync()));

        return self::SUCCESS;
    }
}
