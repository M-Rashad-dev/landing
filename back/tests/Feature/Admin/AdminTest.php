<?php

declare(strict_types=1);

use App\Enums\DomainStatus;
use App\Enums\TenantStatus;
use App\Jobs\RevalidateTenantHosts;
use App\Models\AdminAuditLog;
use App\Models\Domain;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Theme;
use App\Models\User;
use Database\Seeders\ThemeSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    $this->seed(ThemeSeeder::class);
    $this->admin = User::factory()->superAdmin()->create();
    Sanctum::actingAs($this->admin);
});

it('creates a super admin from the interactive command and refuses duplicates', function () {
    $this->artisan('platform:create-admin')
        ->expectsQuestion('Name', 'Platform Owner')
        ->expectsQuestion('Email', 'Owner@Platform.test')
        ->expectsQuestion('Mobile (Egyptian)', '01099998888')
        ->expectsQuestion('Password (min 8 characters)', 'very-secret-1')
        ->expectsQuestion('Repeat the password', 'very-secret-1')
        ->assertSuccessful();

    $user = User::query()->where('email', 'owner@platform.test')->firstOrFail();
    expect($user->isSuperAdmin())->toBeTrue()
        ->and($user->tenant_id)->toBeNull()
        ->and($user->phone)->toBe('+201099998888')
        ->and(Hash::check('very-secret-1', $user->password))->toBeTrue();

    $this->artisan('platform:create-admin')
        ->expectsQuestion('Name', 'Again')
        ->expectsQuestion('Email', 'owner@platform.test')
        ->expectsQuestion('Mobile (Egyptian)', '01099998888')
        ->expectsQuestion('Password (min 8 characters)', 'short')
        ->expectsQuestion('Repeat the password', 'other')
        ->assertFailed();
    expect(User::query()->where('role', 'super_admin')->count())->toBe(2);
});

it('lists tenants with search, status filter and counts', function () {
    $owner = createOwner(['name' => 'Rashad', 'email' => 'rashad@example.com']);
    asTenant($owner, fn () => Order::factory()->count(3)->create());
    $other = createOwner(['name' => 'Mona']);
    $other->tenant->update(['status' => TenantStatus::Suspended]);

    $list = $this->getJson('/api/v1/admin/tenants')->assertOk();
    expect($list->json('meta.total'))->toBe(2);

    $this->getJson('/api/v1/admin/tenants?q=rashad@')
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.owner.email', 'rashad@example.com')
        ->assertJsonPath('data.0.orders_count', 3);
    $sub = asTenant($owner, fn () => Domain::query()->value('host'));
    $this->getJson('/api/v1/admin/tenants?q='.explode('.', $sub)[0])->assertJsonCount(1, 'data')->assertJsonPath('data.0.subdomain', $sub);
    $this->getJson('/api/v1/admin/tenants?status=suspended')->assertJsonCount(1, 'data')->assertJsonPath('data.0.owner.name', 'Mona');
    $this->getJson('/api/v1/admin/tenants?status=nope')->assertStatus(422);
});

it('shows tenant details with domains', function () {
    $owner = createOwner();
    asTenant($owner, fn () => Domain::factory()->custom('brand.com', DomainStatus::Active)->create());

    $this->getJson("/api/v1/admin/tenants/{$owner->tenant_id}")
        ->assertOk()
        ->assertJsonCount(2, 'data.domains')
        ->assertJsonPath('data.status', 'active');
    $this->getJson('/api/v1/admin/tenants/999999')->assertNotFound();
});

it('suspends a tenant: tokens revoked, site revalidated, audited; then activates', function () {
    Queue::fake();
    $owner = createOwner();
    $token = $owner->createToken('web')->plainTextToken;

    $this->postJson("/api/v1/admin/tenants/{$owner->tenant_id}/suspend", ['reason' => ''])->assertStatus(422);
    $this->postJson("/api/v1/admin/tenants/{$owner->tenant_id}/suspend", ['reason' => 'محتوى مخالف'])
        ->assertOk()
        ->assertJsonPath('data.status', 'suspended')
        ->assertJsonPath('data.suspended_reason', 'محتوى مخالف');

    expect($owner->tokens()->count())->toBe(0);
    Queue::assertPushed(RevalidateTenantHosts::class, fn (RevalidateTenantHosts $job) => $job->tenantId === $owner->tenant_id);
    $log = AdminAuditLog::query()->latest('id')->first();
    expect($log->action)->toBe('tenant.suspend')
        ->and($log->admin_user_id)->toBe($this->admin->id)
        ->and($log->target_id)->toBe((string) $owner->tenant_id)
        ->and($log->meta)->toBe(['reason' => 'محتوى مخالف'])
        ->and($log->ip)->not->toBeNull();

    // The site shows the suspended page and the owner cannot sign in.
    $sub = asTenant($owner, fn () => Domain::query()->value('host'));
    $this->getJson('/api/v1/public/resolve-host?host='.$sub, internalHeaders())->assertJsonPath('data.status', 'suspended');
    app('auth')->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/dashboard/orders')->assertUnauthorized();

    Sanctum::actingAs($this->admin);
    $this->postJson("/api/v1/admin/tenants/{$owner->tenant_id}/activate")->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.suspended_reason', null);
    expect(AdminAuditLog::query()->latest('id')->value('action'))->toBe('tenant.activate');
});

it('resets the owner password once and ends every session', function () {
    $owner = createOwner();
    $owner->createToken('web');
    $owner->createToken('phone');

    $password = $this->postJson("/api/v1/admin/tenants/{$owner->tenant_id}/reset-password")->assertOk()->json('data.temporary_password');

    expect($password)->toHaveLength(12)
        ->and(preg_match('/[a-zA-Z]/', $password))->toBe(1)
        ->and(preg_match('/\d/', $password))->toBe(1)
        ->and(Hash::check($password, $owner->fresh()->password))->toBeTrue()
        ->and($owner->tokens()->count())->toBe(0)
        ->and(AdminAuditLog::query()->latest('id')->value('action'))->toBe('tenant.reset_password');
    // The audit log never stores the password.
    expect(json_encode(AdminAuditLog::query()->latest('id')->first()->meta))->not->toContain($password);

    app('auth')->forgetGuards();
    $this->postJson('/api/v1/auth/login', ['login' => $owner->email, 'password' => $password])->assertOk();
});

it('enables and disables themes without touching existing pages', function () {
    $owner = createOwner();
    $page = asTenant($owner, fn () => LandingPage::factory()->published()->create(['theme_key' => 'celia']));

    $this->getJson('/api/v1/admin/themes')->assertOk()->assertJsonFragment(['key' => 'celia', 'is_active' => true, 'in_use' => 1]);
    $this->patchJson('/api/v1/admin/themes/celia', ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
    expect(Theme::query()->find('celia')->is_active)->toBeFalse()
        ->and(asTenant($owner, fn () => $page->fresh()->theme_key))->toBe('celia')
        ->and(AdminAuditLog::query()->latest('id')->first())->action->toBe('theme.disable')->target_id->toBe('celia');

    $this->patchJson('/api/v1/admin/themes/celia', [])->assertStatus(422);
    $this->patchJson('/api/v1/admin/themes/nope', ['is_active' => true])->assertNotFound();
});

it('forbids tenant owners and needs a token', function (string $method, string $uri) {
    Sanctum::actingAs(createOwner());
    $this->json($method, $uri)->assertForbidden();

    app('auth')->forgetGuards();
    $this->json($method, $uri)->assertUnauthorized();
})->with([
    ['GET', '/api/v1/admin/overview'],
    ['GET', '/api/v1/admin/tenants'],
    ['GET', '/api/v1/admin/tenants/1'],
    ['POST', '/api/v1/admin/tenants/1/suspend'],
    ['POST', '/api/v1/admin/tenants/1/activate'],
    ['POST', '/api/v1/admin/tenants/1/reset-password'],
    ['GET', '/api/v1/admin/themes'],
    ['PATCH', '/api/v1/admin/themes/malak'],
]);

it('keeps the super admin out of the dashboard', function () {
    $this->getJson('/api/v1/dashboard/orders')->assertForbidden();
});
