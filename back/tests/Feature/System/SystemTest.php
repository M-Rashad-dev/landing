<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::middleware(['api', 'internal.key'])->get('/api/v1/public/__probe', fn () => ['ok' => true]);
    Route::middleware('api')->get('/api/v1/__boom', fn () => throw new RuntimeException('secret detail'));
});

it('reports health', function () {
    $this->getJson('/health')->assertOk()->assertJsonPath('status', 'ok');
});

it('rejects public routes without the internal key', function () {
    $this->getJson('/api/v1/public/__probe')->assertUnauthorized()->assertJsonPath('code', 'unauthenticated');
});

it('rejects public routes with a wrong internal key', function () {
    $this->getJson('/api/v1/public/__probe', ['X-Internal-Key' => 'wrong'])->assertUnauthorized();
});

it('accepts public routes with the internal key', function () {
    $this->getJson('/api/v1/public/__probe', internalHeaders())->assertOk();
});

it('fails closed when the internal key is not configured', function () {
    config(['landing.internal_api_key' => '']);

    $this->getJson('/api/v1/public/__probe', ['X-Internal-Key' => ''])->assertUnauthorized();
});

it('returns json 404 for unknown api routes', function () {
    $this->getJson('/api/v1/nope')->assertNotFound()->assertJsonPath('code', 'not_found');
});

it('hides exception details when debug is off', function () {
    config(['app.debug' => false]);

    $this->getJson('/api/v1/__boom')
        ->assertStatus(500)
        ->assertJsonPath('code', 'server_error')
        ->assertJsonMissingPath('debug');
});

it('has no web routes', function () {
    $this->get('/')->assertNotFound();
});
