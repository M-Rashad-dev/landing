<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Admin\OverviewController as AdminOverviewController;
use App\Http\Controllers\Api\V1\Admin\TenantController as AdminTenantController;
use App\Http\Controllers\Api\V1\Admin\ThemeController as AdminThemeController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Dashboard\AccountController;
use App\Http\Controllers\Api\V1\Dashboard\BlockedCustomerController;
use App\Http\Controllers\Api\V1\Dashboard\DiscountCodeController;
use App\Http\Controllers\Api\V1\Dashboard\DomainController;
use App\Http\Controllers\Api\V1\Dashboard\IdentityController;
use App\Http\Controllers\Api\V1\Dashboard\LeadController;
use App\Http\Controllers\Api\V1\Dashboard\MediaController;
use App\Http\Controllers\Api\V1\Dashboard\OfferController;
use App\Http\Controllers\Api\V1\Dashboard\OrderController;
use App\Http\Controllers\Api\V1\Dashboard\OverviewController;
use App\Http\Controllers\Api\V1\Dashboard\PageController;
use App\Http\Controllers\Api\V1\Dashboard\PricingController;
use App\Http\Controllers\Api\V1\Dashboard\ProductController;
use App\Http\Controllers\Api\V1\Dashboard\ShippingController;
use App\Http\Controllers\Api\V1\Dashboard\UpsellController;
use App\Http\Controllers\Api\V1\Public\OrderController as PublicOrderController;
use App\Http\Controllers\Api\V1\Public\SiteController;
use App\Http\Controllers\Api\V1\Public\TrackController;
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

        Route::get('upsells', [UpsellController::class, 'index']);
        Route::post('upsells', [UpsellController::class, 'store']);
        Route::put('upsells/{upsell}', [UpsellController::class, 'update']);
        Route::post('upsells/{upsell}/toggle', [UpsellController::class, 'toggle']);
        Route::delete('upsells/{upsell}', [UpsellController::class, 'destroy']);

        Route::post('pricing/preview', [PricingController::class, 'preview']);

        Route::get('themes', [PageController::class, 'themes']);
        Route::apiResource('pages', PageController::class);
        Route::put('pages/{page}/content', [PageController::class, 'saveContent']);
        Route::get('pages/{page}/preview', [PageController::class, 'preview']);
        Route::post('pages/{page}/publish', [PageController::class, 'publish']);
        Route::post('pages/{page}/unpublish', [PageController::class, 'unpublish']);
        Route::post('pages/{page}/duplicate', [PageController::class, 'duplicate']);
        Route::post('pages/{page}/set-home', [PageController::class, 'setHome']);

        Route::get('overview', OverviewController::class);

        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/stats', [OrderController::class, 'stats']);
        Route::get('orders/confirmation-queue', [OrderController::class, 'confirmationQueue']);
        Route::get('orders/export', [OrderController::class, 'export'])->middleware('throttle:orders-export');
        Route::post('orders/bulk-status', [OrderController::class, 'bulkStatus']);
        Route::get('orders/{order}', [OrderController::class, 'show']);
        Route::patch('orders/{order}', [OrderController::class, 'update']);
        Route::post('orders/{order}/status', [OrderController::class, 'changeStatus']);
        Route::post('orders/{order}/contact', [OrderController::class, 'contact']);

        Route::get('leads', [LeadController::class, 'index']);
        Route::patch('leads/{lead}', [LeadController::class, 'update']);
        Route::delete('leads/{lead}', [LeadController::class, 'destroy']);

        Route::get('shipping', [ShippingController::class, 'show']);
        Route::put('shipping', [ShippingController::class, 'update']);

        Route::get('domains', [DomainController::class, 'index']);
        Route::put('domains/subdomain', [DomainController::class, 'updateSubdomain']);
        Route::get('domains/subdomain/availability', [DomainController::class, 'subdomainAvailability']);
        Route::post('domains/custom', [DomainController::class, 'storeCustom']);
        Route::post('domains/{domain}/verify', [DomainController::class, 'verify'])->middleware('throttle:domain-checks');
        Route::post('domains/{domain}/check-ssl', [DomainController::class, 'checkSsl'])->middleware('throttle:domain-checks');
        Route::post('domains/{domain}/make-primary', [DomainController::class, 'makePrimary']);
        Route::delete('domains/{domain}', [DomainController::class, 'destroy']);

        Route::get('blocked-customers', [BlockedCustomerController::class, 'index']);
        Route::post('blocked-customers', [BlockedCustomerController::class, 'store']);
        Route::delete('blocked-customers/{blocked_customer}', [BlockedCustomerController::class, 'destroy']);
    });

Route::prefix('public')
    ->middleware(['internal.key'])
    ->group(function (): void {
        Route::middleware('throttle:public-read')->group(function (): void {
            Route::get('resolve-host', [SiteController::class, 'resolveHost']);
            Route::get('pages', [SiteController::class, 'page']);
            Route::get('sitemap', [SiteController::class, 'sitemap']);
        });
        Route::get('form-token', [PublicOrderController::class, 'formToken'])->middleware('throttle:public-form-token');
        Route::post('quote', [PublicOrderController::class, 'quote'])->middleware('throttle:public-quote');
        Route::post('orders', [PublicOrderController::class, 'store'])->middleware('throttle:public-order-attempts');
        Route::get('brand', [TrackController::class, 'brand'])->middleware('throttle:public-read');
        Route::post('track', [TrackController::class, 'show'])->middleware('throttle:public-track');
        Route::post('upsell', [PublicOrderController::class, 'acceptUpsell'])->middleware('throttle:public-order-attempts');
        Route::post('leads', [PublicOrderController::class, 'lead'])->middleware('throttle:public-leads');
    });

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'super.admin', 'throttle:dashboard'])
    ->group(function (): void {
        Route::get('overview', AdminOverviewController::class);
        Route::get('tenants', [AdminTenantController::class, 'index']);
        Route::get('tenants/{tenant}', [AdminTenantController::class, 'show'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/suspend', [AdminTenantController::class, 'suspend'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/activate', [AdminTenantController::class, 'activate'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/reset-password', [AdminTenantController::class, 'resetPassword'])->whereNumber('tenant');
        Route::get('themes', [AdminThemeController::class, 'index']);
        Route::patch('themes/{key}', [AdminThemeController::class, 'update']);
    });
