<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Domain;
use App\Models\User;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Database\Seeders\DemoSeeder;
use Illuminate\Console\Command;

/** Development only: fills the database with a demo store (DemoSeeder) and prints how to sign in. */
final class PlatformDemo extends Command
{
    protected $signature = 'platform:demo';

    protected $description = 'Create a demo store, pages, orders and a super admin (not in production)';

    public function handle(): int
    {
        if ($this->laravel->environment('production')) {
            $this->error('platform:demo is disabled in production.');

            return self::FAILURE;
        }

        $this->call('db:seed', ['--class' => DemoSeeder::class, '--force' => true]);

        $owner = User::query()->where('email', DemoSeeder::OWNER_EMAIL)->firstOrFail();
        $host = Tenancy::runAs((int) $owner->tenant_id, fn () => Domain::query()->where('is_primary', true)->value('host'));
        $app = PublicSite::url((string) config('landing.app_host'));

        $this->newLine();
        $this->table(['', ''], [
            ['Dashboard', $app.'login'],
            ['Store owner', DemoSeeder::OWNER_EMAIL.' / '.DemoSeeder::PASSWORD],
            ['Super admin', DemoSeeder::ADMIN_EMAIL.' / '.DemoSeeder::PASSWORD],
            ['Public site', PublicSite::url((string) $host)],
        ]);

        return self::SUCCESS;
    }
}
