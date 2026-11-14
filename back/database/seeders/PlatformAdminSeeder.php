<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The platform owner's super admin account on a fresh server, from PLATFORM_ADMIN_* in .env (config landing.platform_admin)
 * (deploy/deploy.sh runs it on every deploy). Never touches an account that already exists, so a
 * password changed after the first sign-in stays changed.
 */
class PlatformAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = strtolower(trim((string) config('landing.platform_admin.email')));
        $password = (string) config('landing.platform_admin.password');
        $phone = trim((string) config('landing.platform_admin.phone'));

        if ($email === '' || $password === '' || $phone === '') {
            $this->command?->warn('PLATFORM_ADMIN_EMAIL / PASSWORD / PHONE are empty: no admin account seeded.');

            return;
        }
        if (User::query()->where('email', $email)->exists()) {
            $this->command?->info("Admin {$email} already exists: left as it is.");

            return;
        }

        User::query()->create([
            'tenant_id' => null,
            'name' => (string) config('landing.platform_admin.name'),
            'email' => $email,
            'phone' => $phone,
            'password' => $password,
            'role' => UserRole::SuperAdmin,
            'is_active' => true,
        ]);
        $this->command?->info("Admin {$email} created.");
    }
}
