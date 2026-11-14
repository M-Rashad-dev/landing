<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Admin\AlertController as AdminAlertController;
use App\Http\Controllers\Api\V1\Admin\AuditLogController as AdminAuditLogController;
use App\Http\Controllers\Api\V1\Admin\OverviewController as AdminOverviewController;
use App\Http\Controllers\Api\V1\Admin\PaymentController as AdminPaymentController;
use App\Http\Controllers\Api\V1\Admin\PlanController as AdminPlanController;
use App\Http\Controllers\Api\V1\Admin\PlatformPageController as AdminPlatformPageController;
use App\Http\Controllers\Api\V1\Admin\TenantBillingController as AdminTenantBillingController;
use App\Http\Controllers\Api\V1\Admin\TenantController as AdminTenantController;
use App\Http\Controllers\Api\V1\Admin\ThemeController as AdminThemeController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Dashboard\AbTestController;
use App\Http\Controllers\Api\V1\Dashboard\AccountController;
use App\Http\Controllers\Api\V1\Dashboard\AnalyticsController;
use App\Http\Controllers\Api\V1\Dashboard\BillingController;
use App\Http\Controllers\Api\V1\Dashboard\BlockedCustomerController;
use App\Http\Controllers\Api\V1\Dashboard\CategoryController;
use App\Http\Controllers\Api\V1\Dashboard\CustomerController;
use App\Http\Controllers\Api\V1\Dashboard\DiscountCodeController;
use App\Http\Controllers\Api\V1\Dashboard\DomainController;
use App\Http\Controllers\Api\V1\Dashboard\HomeController;
use App\Http\Controllers\Api\V1\Dashboard\IdentityController;
use App\Http\Controllers\Api\V1\Dashboard\IntegrationController;
use App\Http\Controllers\Api\V1\Dashboard\InvoiceController;
use App\Http\Controllers\Api\V1\Dashboard\LeadController;
use App\Http\Controllers\Api\V1\Dashboard\MediaController;
use App\Http\Controllers\Api\V1\Dashboard\OfferController;
use App\Http\Controllers\Api\V1\Dashboard\OrderController;
use App\Http\Controllers\Api\V1\Dashboard\OverviewController;
use App\Http\Controllers\Api\V1\Dashboard\PageController;
use App\Http\Controllers\Api\V1\Dashboard\PixelController;
use App\Http\Controllers\Api\V1\Dashboard\PricingController;
use App\Http\Controllers\Api\V1\Dashboard\ProductController;
use App\Http\Controllers\Api\V1\Dashboard\ReviewController;
use App\Http\Controllers\Api\V1\Dashboard\ShippingCompanyController;
use App\Http\Controllers\Api\V1\Dashboard\ShippingController;
use App\Http\Controllers\Api\V1\Dashboard\ShippingOfferController;
use App\Http\Controllers\Api\V1\Dashboard\StoreAnalyticsController;
use App\Http\Controllers\Api\V1\Dashboard\StoreController;
use App\Http\Controllers\Api\V1\Dashboard\StoreDesignController;
use App\Http\Controllers\Api\V1\Dashboard\StorePageController;
use App\Http\Controllers\Api\V1\Dashboard\ThemeStoreController;
use App\Http\Controllers\Api\V1\Dashboard\UpsellController;
use App\Http\Controllers\Api\V1\PlatformPageController;
use App\Http\Controllers\Api\V1\PricingPageController;
use App\Http\Controllers\Api\V1\Public\EventController;
use App\Http\Controllers\Api\V1\Public\OrderController as PublicOrderController;
use App\Http\Controllers\Api\V1\Public\SiteController;
use App\Http\Controllers\Api\V1\Public\StoreAccountController;
use App\Http\Controllers\Api\V1\Public\StoreController as PublicStoreController;
use App\Http\Controllers\Api\V1\Public\TrackController;
use Illuminate\Support\Facades\Route;

/*
| All routes here are prefixed with /api/v1.
| Groups: auth (public + token), dashboard (tenant owner), public (Next only, internal key), admin (super admin).
*/

// Marketing pricing page (public, cached 60 s by the browser).
Route::get('plans', PricingPageController::class)->middleware('throttle:public-plans');
// The platform's own pages (about, terms, privacy…) for the platform domain.
Route::get('platform-pages', [PlatformPageController::class, 'index'])->middleware('throttle:public-plans');
Route::get('platform-pages/{slug}', [PlatformPageController::class, 'show'])->middleware('throttle:public-plans');

Route::prefix('auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

    Route::middleware(['auth:sanctum', 'tenant.active'])->group(function (): void {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

Route::prefix('dashboard')
    ->middleware(['auth:sanctum', 'tenant.user', 'tenant.active', 'plan.writable', 'throttle:dashboard'])
    ->group(function (): void {
        // The owner's own account stays editable on an expired plan.
        Route::patch('profile', [AccountController::class, 'updateProfile'])->withoutMiddleware('plan.writable');
        Route::put('profile/password', [AccountController::class, 'updatePassword'])->withoutMiddleware('plan.writable');

        Route::get('billing/entitlements', [BillingController::class, 'entitlements']);
        Route::get('billing/usage', [BillingController::class, 'usage']);
        Route::get('billing/plans', [BillingController::class, 'plans']);
        Route::get('billing/subscriptions', [BillingController::class, 'subscriptions']);
        Route::get('billing/locks/{limit}', [BillingController::class, 'lockRows']);
        Route::put('billing/locks/{limit}', [BillingController::class, 'chooseLocks']);

        // Paying works on an expired plan too (it is how the store comes back).
        Route::withoutMiddleware('plan.writable')->group(function (): void {
            Route::get('billing/invoices', [InvoiceController::class, 'index']);
            Route::post('billing/checkout/preview', [InvoiceController::class, 'preview']);
            Route::post('billing/checkout', [InvoiceController::class, 'checkout'])->middleware('throttle:receipt-upload');
            Route::get('billing/invoices/{invoice}', [InvoiceController::class, 'show']);
            Route::post('billing/invoices/{invoice}/cancel', [InvoiceController::class, 'cancel']);
            Route::post('billing/invoices/{invoice}/payments', [InvoiceController::class, 'pay'])->middleware('throttle:receipt-upload');
            Route::get('billing/invoices/{invoice}/payments/{payment}/receipt', [InvoiceController::class, 'receipt']);
            Route::post('billing/refund', [InvoiceController::class, 'refund']);
        });
        Route::patch('store', [AccountController::class, 'updateStore']);

        Route::get('media', [MediaController::class, 'index']);
        Route::post('media', [MediaController::class, 'store'])->middleware('throttle:media-upload');
        Route::patch('media/{media}', [MediaController::class, 'update']);
        Route::delete('media/{media}', [MediaController::class, 'destroy']);

        Route::apiResource('identities', IdentityController::class);
        Route::post('identities/{identity}/make-default', [IdentityController::class, 'makeDefault']);

        Route::post('products/bulk', [ProductController::class, 'bulk']);
        Route::apiResource('products', ProductController::class);
        Route::patch('products/{product}/quick', [ProductController::class, 'quick']);
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

        Route::get('store', [StoreController::class, 'show']);
        Route::post('store/setup', [StoreController::class, 'setup']);
        Route::put('store', [StoreController::class, 'update']);
        Route::get('store/design', [StoreDesignController::class, 'show']);
        Route::put('store/design', [StoreDesignController::class, 'update']);
        Route::post('store/design/publish', [StoreDesignController::class, 'publish']);
        Route::get('categories', [CategoryController::class, 'index']);
        Route::post('categories', [CategoryController::class, 'store']);
        Route::put('categories/order', [CategoryController::class, 'reorder']);
        Route::put('categories/{category}', [CategoryController::class, 'update']);
        Route::delete('categories/{category}', [CategoryController::class, 'destroy']);
        Route::put('store-pages/order', [StorePageController::class, 'reorder']);
        Route::apiResource('store-pages', StorePageController::class)->except(['show']);
        Route::get('store/analytics', StoreAnalyticsController::class);

        Route::get('themes', [ThemeStoreController::class, 'mine']);
        Route::get('theme-store', [ThemeStoreController::class, 'index']);
        Route::get('theme-store/{key}', [ThemeStoreController::class, 'show']);
        Route::apiResource('pages', PageController::class);
        Route::put('pages/{page}/content', [PageController::class, 'saveContent']);
        Route::get('pages/{page}/preview', [PageController::class, 'preview']);
        Route::post('pages/{page}/publish', [PageController::class, 'publish']);
        Route::post('pages/{page}/unpublish', [PageController::class, 'unpublish']);
        Route::post('pages/{page}/duplicate', [PageController::class, 'duplicate']);
        Route::post('pages/{page}/set-home', [PageController::class, 'setHome']);

        Route::get('overview', OverviewController::class);
        Route::get('home', HomeController::class);
        Route::get('analytics', AnalyticsController::class);

        Route::get('ab-tests', [AbTestController::class, 'index']);
        Route::post('ab-tests', [AbTestController::class, 'store']);
        Route::post('ab-tests/{ab_test}/finish', [AbTestController::class, 'finish']);
        Route::delete('ab-tests/{ab_test}', [AbTestController::class, 'destroy']);

        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/stats', [OrderController::class, 'stats']);
        Route::get('orders/confirmation-queue', [OrderController::class, 'confirmationQueue']);
        Route::get('orders/export', [OrderController::class, 'export'])->middleware('throttle:orders-export');
        Route::post('orders/bulk-status', [OrderController::class, 'bulkStatus']);
        Route::get('orders/{order}', [OrderController::class, 'show']);
        Route::patch('orders/{order}', [OrderController::class, 'update']);
        Route::post('orders/{order}/status', [OrderController::class, 'changeStatus']);
        Route::post('orders/{order}/contact', [OrderController::class, 'contact']);

        Route::get('reviews', [ReviewController::class, 'index']);
        Route::patch('reviews/{review}', [ReviewController::class, 'update']);
        Route::get('customers', [CustomerController::class, 'index']);
        Route::get('customers/{customer}', [CustomerController::class, 'show']);
        Route::patch('customers/{customer}', [CustomerController::class, 'update']);
        Route::post('customers/{customer}/block', [CustomerController::class, 'block']);

        Route::get('leads', [LeadController::class, 'index']);
        Route::patch('leads/{lead}', [LeadController::class, 'update']);
        Route::delete('leads/{lead}', [LeadController::class, 'destroy']);

        Route::get('pixels', [PixelController::class, 'show']);
        Route::put('pixels', [PixelController::class, 'update']);
        Route::get('integrations', [IntegrationController::class, 'index']);
        Route::post('integrations', [IntegrationController::class, 'store']);
        Route::put('integrations/{webhook}', [IntegrationController::class, 'update']);
        Route::post('integrations/{webhook}/toggle', [IntegrationController::class, 'toggle']);
        Route::post('integrations/{webhook}/rotate-secret', [IntegrationController::class, 'rotateSecret']);
        Route::post('integrations/{webhook}/test', [IntegrationController::class, 'test'])->middleware('throttle:integration-tests');
        Route::get('integrations/{webhook}/deliveries', [IntegrationController::class, 'deliveries']);
        Route::delete('integrations/{webhook}', [IntegrationController::class, 'destroy']);

        Route::get('shipping', [ShippingController::class, 'show']);
        Route::put('shipping', [ShippingController::class, 'update']);
        Route::put('shipping-companies/order', [ShippingCompanyController::class, 'reorder']);
        Route::apiResource('shipping-companies', ShippingCompanyController::class)->except('index');
        Route::post('shipping-companies/{shipping_company}/toggle', [ShippingCompanyController::class, 'toggle']);
        Route::apiResource('shipping-offers', ShippingOfferController::class);
        Route::post('shipping-offers/{shipping_offer}/toggle', [ShippingOfferController::class, 'toggle']);

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
        Route::post('events', [EventController::class, 'store'])->middleware('throttle:public-events');
        Route::get('ab-routes', [EventController::class, 'abRoutes'])->middleware('throttle:public-read');

        // The online store.
        Route::middleware('throttle:public-read')->group(function (): void {
            Route::get('store', [PublicStoreController::class, 'config']);
            Route::get('store/products', [PublicStoreController::class, 'products']);
            Route::get('store/products/{slug}', [PublicStoreController::class, 'product']);
            Route::get('store/pages/{slug}', [PublicStoreController::class, 'page']);
        });
        Route::get('store/form-token', [PublicStoreController::class, 'formToken'])->middleware('throttle:public-form-token');
        Route::post('store/quote', [PublicStoreController::class, 'quote'])->middleware('throttle:public-quote');
        Route::post('store/orders', [PublicStoreController::class, 'order'])->middleware('throttle:public-order-attempts');
        Route::post('store/leads', [PublicStoreController::class, 'lead'])->middleware('throttle:public-leads');
        Route::post('store/carts', [PublicStoreController::class, 'cart'])->middleware('throttle:public-leads');
        Route::post('store/events', [PublicStoreController::class, 'event'])->middleware('throttle:public-events');

        // Storefront customer accounts (phone + one-time code) and product reviews.
        Route::get('store/products/{slug}/reviews', [StoreAccountController::class, 'productReviews'])->middleware('throttle:public-read');
        Route::post('store/account/code', [StoreAccountController::class, 'sendCode'])->middleware('throttle:public-account-code');
        Route::post('store/account/verify', [StoreAccountController::class, 'verify'])->middleware('throttle:public-account-code');
        Route::middleware('throttle:public-account')->group(function (): void {
            Route::get('store/account', [StoreAccountController::class, 'show']);
            Route::put('store/account', [StoreAccountController::class, 'update']);
            Route::post('store/account/sign-out', [StoreAccountController::class, 'signOut']);
            Route::get('store/account/orders', [StoreAccountController::class, 'orders']);
            Route::get('store/account/orders/{number}', [StoreAccountController::class, 'order'])->whereNumber('number');
            Route::post('store/account/addresses', [StoreAccountController::class, 'storeAddress']);
            Route::put('store/account/addresses/{address}', [StoreAccountController::class, 'updateAddress'])->whereNumber('address');
            Route::delete('store/account/addresses/{address}', [StoreAccountController::class, 'destroyAddress'])->whereNumber('address');
            Route::get('store/account/reviews', [StoreAccountController::class, 'myReview']);
            Route::put('store/account/reviews', [StoreAccountController::class, 'review']);
        });
    });

Route::prefix('admin')
    ->middleware(['auth:sanctum', 'super.admin', 'throttle:dashboard'])
    ->group(function (): void {
        Route::get('overview', AdminOverviewController::class);
        Route::get('alerts', [AdminAlertController::class, 'show']);
        Route::put('alerts', [AdminAlertController::class, 'update']);
        Route::post('alerts/test', [AdminAlertController::class, 'test'])->middleware('throttle:6,1');
        Route::get('audit-logs', [AdminAuditLogController::class, 'index']);
        Route::get('tenants', [AdminTenantController::class, 'index']);
        Route::get('tenants/{tenant}', [AdminTenantController::class, 'show'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/suspend', [AdminTenantController::class, 'suspend'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/activate', [AdminTenantController::class, 'activate'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/reset-password', [AdminTenantController::class, 'resetPassword'])->whereNumber('tenant');
        Route::get('themes', [AdminThemeController::class, 'index']);
        Route::patch('themes/{key}', [AdminThemeController::class, 'update']);
        Route::get('themes/{key}', [AdminThemeController::class, 'show']);
        Route::put('themes/{key}', [AdminThemeController::class, 'updateDetails']);
        Route::post('themes/{key}/images', [AdminThemeController::class, 'storeImage']);
        Route::put('themes/{key}/images/order', [AdminThemeController::class, 'reorderImages']);
        Route::delete('themes/{key}/images/{image}', [AdminThemeController::class, 'destroyImage'])->whereNumber('image');
        Route::post('theme-tags', [AdminThemeController::class, 'storeTag']);
        Route::delete('theme-tags/{tag}', [AdminThemeController::class, 'destroyTag'])->whereNumber('tag');
        Route::get('tenants/{tenant}/themes', [AdminThemeController::class, 'tenantThemes'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/themes', [AdminThemeController::class, 'grant'])->whereNumber('tenant');
        Route::delete('tenants/{tenant}/themes/{key}', [AdminThemeController::class, 'revoke'])->whereNumber('tenant');

        Route::get('plans', [AdminPlanController::class, 'index']);
        Route::post('plans', [AdminPlanController::class, 'store']);
        Route::put('plans/{key}', [AdminPlanController::class, 'update']);
        Route::delete('plans/{key}', [AdminPlanController::class, 'destroy']);
        Route::put('billing/settings', [AdminPlanController::class, 'updateSettings']);

        Route::get('platform-pages', [AdminPlatformPageController::class, 'index']);
        Route::get('platform-pages/{slug}', [AdminPlatformPageController::class, 'show']);
        Route::put('platform-pages/{slug}', [AdminPlatformPageController::class, 'update']);

        Route::get('payments', [AdminPaymentController::class, 'index']);
        Route::get('payments/{payment}/receipt', [AdminPaymentController::class, 'receipt'])->whereNumber('payment');
        Route::post('payments/{payment}/approve', [AdminPaymentController::class, 'approve'])->whereNumber('payment');
        Route::post('payments/{payment}/reject', [AdminPaymentController::class, 'reject'])->whereNumber('payment');
        Route::get('refunds', [AdminPaymentController::class, 'refunds']);
        Route::post('invoices/{invoice}/refund', [AdminPaymentController::class, 'completeRefund'])->whereNumber('invoice');
        Route::get('payment-methods', [AdminPaymentController::class, 'methods']);
        Route::put('payment-methods/{key}', [AdminPaymentController::class, 'updateMethod']);

        Route::get('tenants/{tenant}/billing', [AdminTenantBillingController::class, 'show'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/billing/grant', [AdminTenantBillingController::class, 'grant'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/billing/extend', [AdminTenantBillingController::class, 'extend'])->whereNumber('tenant');
        Route::put('tenants/{tenant}/billing/overrides/{entitlement}', [AdminTenantBillingController::class, 'setOverride'])->whereNumber('tenant');
        Route::delete('tenants/{tenant}/billing/overrides/{entitlement}', [AdminTenantBillingController::class, 'deleteOverride'])->whereNumber('tenant');
    });
