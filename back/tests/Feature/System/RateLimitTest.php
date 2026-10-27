<?php

declare(strict_types=1);

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/*
| PLAN section 21: every limit in the table, checked against the limiter definitions,
| plus behaviour for the public endpoints (the limit applies before any lookup).
*/

function limitFor(string $name, Request $request): Limit
{
    $limit = RateLimiter::limiter($name)($request);

    return is_array($limit) ? $limit[0] : $limit;
}

it('defines the limits from the plan', function (string $name, int $max, int $decaySeconds) {
    $request = Request::create('/x', 'POST', ['login' => 'a@b.c', 'ip' => '41.0.0.1']);
    $limit = limitFor($name, $request);

    expect($limit->maxAttempts)->toBe($max)->and($limit->decaySeconds)->toBe($decaySeconds);
})->with([
    'register: 5 / hour / IP' => ['register', 5, 3600],
    'login: 5 / minute / IP + login' => ['login', 5, 60],
    'form token: 30 / minute / IP' => ['public-form-token', 30, 60],
    'quote: 60 / minute / IP' => ['public-quote', 60, 60],
    'domain checks: 10 / minute / tenant' => ['domain-checks', 10, 60],
    'tls ask: 60 / minute' => ['tls-ask', 60, 60],
    'media upload: 30 / minute / tenant' => ['media-upload', 30, 60],
    'dashboard: 300 / minute / user' => ['dashboard', 300, 60],
]);

it('keys visitor limits by the forwarded visitor IP', function () {
    $a = limitFor('public-form-token', Request::create('/x', 'GET', ['ip' => '41.0.0.1']));
    $b = limitFor('public-form-token', Request::create('/x', 'GET', ['ip' => '41.0.0.2']));
    $login = limitFor('login', Request::create('/x', 'POST', ['login' => ' A@B.c ']));

    expect($a->key)->not->toBe($b->key)->and($login->key)->toEndWith('|a@b.c');
});

it('limits form tokens to 30 per minute per visitor IP', function () {
    for ($i = 0; $i < 30; $i++) {
        $this->getJson('/api/v1/public/form-token?host=nope.test&slug=x&ip=41.9.9.9', internalHeaders())->assertNotFound();
    }
    $this->getJson('/api/v1/public/form-token?host=nope.test&slug=x&ip=41.9.9.9', internalHeaders())->assertStatus(429);
    $this->getJson('/api/v1/public/form-token?host=nope.test&slug=x&ip=41.9.9.10', internalHeaders())->assertNotFound();
});

it('limits quotes to 60 per minute per visitor IP', function () {
    for ($i = 0; $i < 60; $i++) {
        $this->postJson('/api/v1/public/quote', ['ip' => '41.8.8.8'], internalHeaders())->assertStatus(422);
    }
    $this->postJson('/api/v1/public/quote', ['ip' => '41.8.8.8'], internalHeaders())->assertStatus(429);
});

it('limits the TLS ask to 60 per minute', function () {
    for ($i = 0; $i < 60; $i++) {
        $this->get('/internal/tls/ask?domain=unknown.example')->assertNotFound();
    }
    $this->get('/internal/tls/ask?domain=unknown.example')->assertStatus(429);
});
