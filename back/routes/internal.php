<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use App\Http\Controllers\LocalMediaController;
use App\Http\Controllers\TlsAskController;
use Illuminate\Support\Facades\Route;

// Docker network only; Caddy never proxies these to the internet.
Route::get('health', HealthController::class);

// Caddy on-demand TLS: may a certificate be issued for ?domain= ? Read only.
Route::get('internal/tls/ask', TlsAskController::class)->middleware('throttle:tls-ask');

// Development only: in production Caddy serves /media/* straight from the volume.
if (! app()->environment('production')) {
    Route::get('media/{path}', LocalMediaController::class)->where('path', '.*');
}
