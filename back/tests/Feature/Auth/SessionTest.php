<?php

declare(strict_types=1);

use App\Models\Tenant;
use App\Models\User;

function loginToken(string $email = 'owner@example.com'): string
{
    return test()->postJson('/api/v1/auth/login', ['login' => $email, 'password' => 'secret-pass-1'])->json('data.token');
}

beforeEach(function () {
    $this->user = createOwner(['email' => 'owner@example.com', 'password' => 'secret-pass-1']);
});

it('returns the current user, tenant and primary host', function () {
    $this->withToken(loginToken())->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.user.email', 'owner@example.com')
        ->assertJsonPath('data.tenant.id', $this->user->tenant_id)
        ->assertJsonPath('data.primary_host', fn ($host) => str_ends_with($host, '.platform.test'));
});

it('requires a token for me', function () {
    $this->getJson('/api/v1/auth/me')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
});

it('logout revokes the current token', function () {
    $token = loginToken();

    $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

    app('auth')->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('issues tokens that expire after 30 days', function () {
    loginToken();
    $token = User::query()->firstOrFail()->tokens()->firstOrFail();

    expect((int) round(now()->diffInDays($token->expires_at)))->toBe(30);
});

it('rejects expired tokens', function () {
    $token = loginToken();
    $this->travel(31)->days();

    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('blocks a suspended tenant from me with 403', function () {
    $token = loginToken();
    Tenant::query()->whereKey($this->user->tenant_id)->update(['status' => 'suspended']);

    $this->withToken($token)->getJson('/api/v1/auth/me')->assertForbidden()->assertJsonPath('code', 'tenant_suspended');
});
