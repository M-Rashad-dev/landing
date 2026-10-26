<?php

declare(strict_types=1);

use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\UserRole;
use App\Models\Domain;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;

function registerPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'محمد رشاد',
        'email' => 'Rashad@Example.com',
        'phone' => '01012345678',
        'store_name' => 'Rashad Store',
        'password' => 'secret-pass-1',
        'password_confirmation' => 'secret-pass-1',
    ], $overrides);
}

it('registers a tenant, owner, active primary subdomain and returns a token', function () {
    $response = $this->postJson('/api/v1/auth/register', registerPayload());

    $response->assertCreated()
        ->assertJsonStructure(['data' => ['user' => ['id', 'email', 'phone'], 'tenant' => ['id', 'name'], 'domain' => ['host'], 'token']]);

    $user = User::query()->firstOrFail();
    expect($user->email)->toBe('rashad@example.com')
        ->and($user->phone)->toBe('+201012345678')
        ->and($user->role)->toBe(UserRole::Owner)
        ->and(Tenant::query()->firstOrFail()->name)->toBe('Rashad Store');

    $domain = Tenancy::withoutTenant(fn () => Domain::query()->firstOrFail());
    expect($domain->tenant_id)->toBe($user->tenant_id)
        ->and($domain->type)->toBe(DomainType::Subdomain)
        ->and($domain->status)->toBe(DomainStatus::Active)
        ->and($domain->is_primary)->toBeTrue()
        ->and($domain->active_host)->toBe($domain->host)
        ->and($domain->host)->toMatch('/^rashad-store-\d{4}\.platform\.test$/');

    $this->withToken($response->json('data.token'))->getJson('/api/v1/auth/me')->assertOk();
});

it('rejects a duplicate email', function () {
    User::factory()->create(['email' => 'rashad@example.com']);

    $this->postJson('/api/v1/auth/register', registerPayload())
        ->assertStatus(422)
        ->assertJsonPath('code', 'validation_failed')
        ->assertJsonValidationErrors('email');
});

it('rejects a duplicate phone in any format', function () {
    User::factory()->create(['phone' => '+201012345678']);

    $this->postJson('/api/v1/auth/register', registerPayload(['phone' => '+20 10 1234 5678']))
        ->assertStatus(422)
        ->assertJsonValidationErrors('phone');
});

it('rejects a non-egyptian phone', function () {
    $this->postJson('/api/v1/auth/register', registerPayload(['phone' => '+966512345678']))
        ->assertStatus(422)
        ->assertJsonPath('errors.phone.0', 'رقم الموبايل غير صحيح.');
});

it('validates required fields in arabic', function () {
    $this->postJson('/api/v1/auth/register', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name', 'email', 'phone', 'store_name', 'password'])
        ->assertJsonPath('message', 'البيانات المرسلة غير صحيحة.');
});

it('rate limits registration per ip', function () {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/register', registerPayload([
            'email' => "user{$i}@example.com",
            'phone' => '0101234567'.$i,
        ]))->assertCreated();
    }

    $this->postJson('/api/v1/auth/register', registerPayload(['email' => 'x@example.com', 'phone' => '01112345678']))
        ->assertStatus(429)
        ->assertJsonPath('code', 'too_many_requests');
});

it('generates a valid subdomain for arabic-only names', function () {
    $this->postJson('/api/v1/auth/register', registerPayload(['store_name' => 'متجر']))->assertCreated();

    $host = Tenancy::withoutTenant(fn () => Domain::query()->value('host'));
    expect($host)->toMatch('/^[a-z0-9-]+-\d{4}\.platform\.test$/');
});
