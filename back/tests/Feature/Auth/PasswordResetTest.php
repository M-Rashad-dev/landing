<?php

declare(strict_types=1);

use App\Enums\MessagePurpose;
use App\Messaging\WhatsApp\WhatsAppTemplates;
use App\Models\OutboundMessage;
use App\Models\PasswordResetCode;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

function resetOwner(): User
{
    return createOwner(['phone' => '+201011112222', 'email' => 'owner@shop.test', 'password' => Hash::make('old-password-1')]);
}

function askResetCode(string $login)
{
    return test()->postJson('/api/v1/auth/password/code', ['login' => $login]);
}

it('resets a forgotten password with a code and signs out everywhere', function () {
    $owner = resetOwner();
    $owner->createToken('old');

    $code = askResetCode('٠١٠١١١١٢٢٢٢')->assertOk()->assertJsonPath('data.channel', 'screen')->json('data.code');
    expect($code)->toMatch('/^\d{6}$/')
        ->and(PasswordResetCode::query()->sole()->code_hash)->not->toContain($code);

    $this->postJson('/api/v1/auth/password/reset', ['login' => 'OWNER@shop.test', 'code' => $code, 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1'])
        ->assertNoContent();

    expect(Hash::check('new-password-1', $owner->fresh()->password))->toBeTrue()
        ->and($owner->tokens()->count())->toBe(0);
    $this->postJson('/api/v1/auth/login', ['login' => 'owner@shop.test', 'password' => 'new-password-1'])->assertOk();
    // The code works once.
    $this->postJson('/api/v1/auth/password/reset', ['login' => 'owner@shop.test', 'code' => $code, 'password' => 'other-pass-22', 'password_confirmation' => 'other-pass-22'])
        ->assertStatus(422)->assertJsonValidationErrors('code');
});

it('answers the same for an unknown account', function () {
    askResetCode('nobody@shop.test')->assertOk()->assertJsonPath('data.code', null)->assertJsonPath('data.expires_in', 300);
    expect(PasswordResetCode::query()->count())->toBe(0);
});

it('validates the reset request', function () {
    $this->postJson('/api/v1/auth/password/code', [])->assertStatus(422)->assertJsonValidationErrors('login');
    $this->postJson('/api/v1/auth/password/reset', ['login' => 'a@b.c', 'code' => '12', 'password' => 'short', 'password_confirmation' => 'other'])
        ->assertStatus(422)->assertJsonValidationErrors(['code', 'password']);
});

it('stops guessing after five wrong codes and limits how often codes are sent', function () {
    resetOwner();
    $code = askResetCode('owner@shop.test')->json('data.code');
    $wrong = $code === '111111' ? '222222' : '111111';
    $body = ['login' => 'owner@shop.test', 'code' => $wrong, 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1'];

    foreach (range(1, 5) as $_) {
        $this->postJson('/api/v1/auth/password/reset', $body)->assertStatus(422);
    }
    $this->postJson('/api/v1/auth/password/reset', ['code' => $code] + $body)->assertStatus(422)->assertJsonValidationErrors('code');

    askResetCode('OWNER@shop.test ')->assertStatus(429)->assertJsonPath('code', 'code_wait');
});

it('sends the reset code on WhatsApp to the account phone', function () {
    config([
        'services.whatsapp.token' => 't', 'services.whatsapp.phone_number_id' => '111', 'services.whatsapp.waba_id' => '222',
        'services.whatsapp.graph_url' => 'https://graph.facebook.com/v23.0',
    ]);
    $owner = resetOwner();
    Http::fake(['https://graph.facebook.com/v23.0/111/messages' => Http::response(['messages' => [['id' => 'wamid.RESET']]])]);

    askResetCode('owner@shop.test')->assertOk()->assertJsonPath('data.channel', 'whatsapp')->assertJsonPath('data.code', null);

    Http::assertSent(fn (Request $request): bool => $request->data()['to'] === '201011112222' && $request->data()['template']['name'] === WhatsAppTemplates::CODE);
    expect(OutboundMessage::query()->sole())
        ->purpose->toBe(MessagePurpose::MerchantCode)
        ->tenant_id->toBe($owner->tenant_id);
});

it('refuses on-screen codes in production', function () {
    resetOwner();
    app()->detectEnvironment(fn () => 'production');

    askResetCode('owner@shop.test')->assertStatus(503)->assertJsonPath('code', 'reset_unavailable');
});
