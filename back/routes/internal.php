<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use App\Http\Controllers\LocalMediaController;
use Illuminate\Support\Facades\Route;

// Docker network only; Caddy never proxies these to the internet.
Route::get('health', HealthController::class);

// Development only: in production Caddy serves /media/* straight from the volume.
if (! app()->environment('production')) {
    Route::get('media/{path}', LocalMediaController::class)->where('path', '.*');
}
