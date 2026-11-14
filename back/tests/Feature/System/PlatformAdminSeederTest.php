<?php

declare(strict_types=1);

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\PlatformAdminSeeder;
use Illuminate\Support\Facades\Hash;

it('creates the owner\'s super admin from the env once, and never touches it again', function (): void {
    config(['landing.platform_admin' => ['name' => 'Owner', 'email' => 'Owner@Example.com', 'password' => 'first-pass-1', 'phone' => '01012345678']]);

    $this->seed(PlatformAdminSeeder::class);
    $admin = User::query()->where('email', 'owner@example.com')->sole();
    expect($admin->role)->toBe(UserRole::SuperAdmin)
        ->and($admin->tenant_id)->toBeNull()
        ->and(Hash::check('first-pass-1', $admin->password))->toBeTrue();

    // A later deploy with another password keeps the account (and a password changed since) as is.
    config(['landing.platform_admin.password' => 'other-pass-2']);
    $this->seed(PlatformAdminSeeder::class);
    expect(User::query()->count())->toBe(1)
        ->and(Hash::check('first-pass-1', $admin->fresh()->password))->toBeTrue();
});

it('seeds nothing while the env is empty', function (): void {
    config(['landing.platform_admin' => ['name' => 'Admin', 'email' => '', 'password' => '', 'phone' => '']]);

    $this->seed(PlatformAdminSeeder::class);

    expect(User::query()->count())->toBe(0);
});
