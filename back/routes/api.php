<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Dashboard\AccountController;
use App\Http\Controllers\Api\V1\Dashboard\DiscountCodeController;
use App\Http\Controllers\Api\V1\Dashboard\IdentityController;
use App\Http\Controllers\Api\V1\Dashboard\MediaController;
use App\Http\Controllers\Api\V1\Dashboard\OfferController;
use App\Http\Controllers\Api\V1\Dashboard\PricingController;
use App\Http\Controllers\Api\V1\Dashboard\ProductController;
use Illuminate\Support\Facades\Route;

/*
| All routes here are prefixed with /api/v1.
| Groups: auth (public + token), dashboard (tenant owner), public (Next only, internal key), admin (super admin).
*/

Route::prefix('auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'tenant.active'])->group(function (): void {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

Route::prefix('dashboard')
    ->middleware(['auth:sanctum', 'tenant.user', 'tenant.active', 'throttle:dashboard'])
    ->group(function (): void {
        Route::patch('profile', [AccountController::class, 'updateProfile']);
        Route::put('profile/password', [AccountController::class, 'updatePassword']);
        Route::patch('store', [AccountController::class, 'updateStore']);

        Route::get('media', [MediaController::class, 'index']);
        Route::post('media', [MediaController::class, 'store'])->middleware('throttle:media-upload');
        Route::patch('media/{media}', [MediaController::class, 'update']);
        Route::delete('media/{media}', [MediaController::class, 'destroy']);

        Route::apiResource('identities', IdentityController::class);
        Route::post('identities/{identity}/make-default', [IdentityController::class, 'makeDefault']);

        Route::apiResource('products', ProductController::class);
        Route::post('products/{product}/toggle', [ProductController::class, 'toggle']);
        Route::post('products/{product}/duplicate', [ProductController::class, 'duplicate']);

        Route::apiResource('offers', OfferController::class);
        Route::post('offers/{offer}/toggle', [OfferController::class, 'toggle']);

        Route::apiResource('discount-codes', DiscountCodeController::class);
        Route::post('discount-codes/{discount_code}/toggle', [DiscountCodeController::class, 'toggle']);
        Route::get('discount-codes/{discount_code}/redemptions', [DiscountCodeController::class, 'redemptions']);

        Route::post('pricing/preview', [PricingController::class, 'preview']);
    });

Route::prefix('public')
    ->middleware(['internal.key'])
    ->group(function (): void {
        // Phase 8+: resolve-host, pages, sitemap, form-token, quote, orders.
    });

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'super.admin'])
    ->group(function (): void {
        // Phase 11: overview, tenants, themes.
    });
