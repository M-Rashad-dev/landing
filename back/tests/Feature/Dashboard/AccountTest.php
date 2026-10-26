<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

it('updates the profile', function () {
    $user = actingAsOwner();

    $this->patchJson('/api/v1/dashboard/profile', ['name' => 'اسم جديد', 'email' => 'NEW@example.com', 'phone' => '01198765432'])
        ->assertOk()
        ->assertJsonPath('data.email', 'new@example.com')
        ->assertJsonPath('data.phone', '+201198765432');

    expect($user->fresh()->name)->toBe('اسم جديد');
});

it('rejects an email used by another account', function () {
    User::factory()->create(['email' => 'taken@example.com']);
    actingAsOwner();

    $this->patchJson('/api/v1/dashboard/profile', ['email' => 'taken@example.com'])
        ->assertStatus(422)->assertJsonValidationErrors('email');
});

it('allows keeping my own email', function () {
    $user = actingAsOwner(createOwner(['email' => 'me@example.com']));

    $this->patchJson('/api/v1/dashboard/profile', ['email' => 'me@example.com'])->assertOk();
    expect($user->fresh()->email)->toBe('me@example.com');
});

it('changes the password with the current password', function () {
    $user = actingAsOwner(createOwner(['password' => 'old-pass-123']));

    $this->putJson('/api/v1/dashboard/profile/password', [
        'current_password' => 'old-pass-123',
        'password' => 'new-pass-456',
        'password_confirmation' => 'new-pass-456',
    ])->assertOk();

    expect(Hash::check('new-pass-456', $user->fresh()->password))->toBeTrue();
});

it('rejects a wrong current password', function () {
    actingAsOwner(createOwner(['password' => 'old-pass-123']));

    $this->putJson('/api/v1/dashboard/profile/password', [
        'current_password' => 'nope',
        'password' => 'new-pass-456',
        'password_confirmation' => 'new-pass-456',
    ])->assertStatus(422)->assertJsonValidationErrors('current_password');
});

it('renames the store', function () {
    $user = actingAsOwner();

    $this->patchJson('/api/v1/dashboard/store', ['name' => 'متجري الجديد'])
        ->assertOk()
        ->assertJsonPath('data.name', 'متجري الجديد');

    expect($user->tenant->fresh()->name)->toBe('متجري الجديد');
});

it('requires authentication for dashboard routes', function (string $method, string $uri) {
    $this->json($method, $uri)->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
})->with([
    ['PATCH', '/api/v1/dashboard/profile'],
    ['PUT', '/api/v1/dashboard/profile/password'],
    ['PATCH', '/api/v1/dashboard/store'],
]);

it('forbids super admins from dashboard routes (no tenant)', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->patchJson('/api/v1/dashboard/store', ['name' => 'x'])->assertForbidden();
});
