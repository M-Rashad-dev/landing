<?php

declare(strict_types=1);

use App\Models\Tenant;

beforeEach(function () {
    $this->user = createOwner(['email' => 'owner@example.com', 'phone' => '+201012345678', 'password' => 'secret-pass-1']);
});

it('logs in with email', function () {
    $this->postJson('/api/v1/auth/login', ['login' => 'OWNER@example.com', 'password' => 'secret-pass-1'])
        ->assertOk()
        ->assertJsonStructure(['data' => ['user', 'tenant', 'token']]);

    expect($this->user->fresh()->last_login_at)->not->toBeNull();
});

it('logs in with phone in any format', function (string $login) {
    $this->postJson('/api/v1/auth/login', ['login' => $login, 'password' => 'secret-pass-1'])->assertOk();
})->with(['01012345678', '+201012345678', '٠١٠١٢٣٤٥٦٧٨']);

it('uses one message for wrong password and unknown account', function (string $login, string $password) {
    $this->postJson('/api/v1/auth/login', ['login' => $login, 'password' => $password])
        ->assertStatus(422)
        ->assertJsonPath('code', 'invalid_credentials')
        ->assertJsonPath('message', 'بيانات الدخول غير صحيحة.');
})->with([
    ['owner@example.com', 'wrong-pass'],
    ['nobody@example.com', 'secret-pass-1'],
    ['01199999999', 'secret-pass-1'],
]);

it('rejects inactive accounts with 403', function () {
    $this->user->update(['is_active' => false]);

    $this->postJson('/api/v1/auth/login', ['login' => 'owner@example.com', 'password' => 'secret-pass-1'])
        ->assertForbidden()
        ->assertJsonPath('code', 'account_inactive');
});

it('rejects suspended tenants with 403', function () {
    Tenant::query()->whereKey($this->user->tenant_id)->update(['status' => 'suspended']);

    $this->postJson('/api/v1/auth/login', ['login' => 'owner@example.com', 'password' => 'secret-pass-1'])
        ->assertForbidden()
        ->assertJsonPath('code', 'tenant_suspended');
});

it('rate limits login per ip and login', function () {
    foreach (range(1, 5) as $i) {
        $this->postJson('/api/v1/auth/login', ['login' => 'owner@example.com', 'password' => 'wrong'])->assertStatus(422);
    }

    $this->postJson('/api/v1/auth/login', ['login' => 'owner@example.com', 'password' => 'secret-pass-1'])
        ->assertStatus(429);

    // A different login from the same IP is a separate bucket.
    $this->postJson('/api/v1/auth/login', ['login' => 'other@example.com', 'password' => 'x'])->assertStatus(422);
});

it('validates login input', function () {
    $this->postJson('/api/v1/auth/login', [])->assertStatus(422)->assertJsonValidationErrors(['login', 'password']);
});
