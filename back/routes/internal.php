<?php

declare(strict_types=1);

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// Docker network only; Caddy never proxies these to the internet.
Route::get('health', HealthController::class);
