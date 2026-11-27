<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Admin\AiArticleController as AdminAiArticleController;
use App\Http\Controllers\Api\V1\Admin\AiController as AdminAiController;
use App\Http\Controllers\Api\V1\Admin\AiWalletController as AdminAiWalletController;
use App\Http\Controllers\Api\V1\Admin\AlertController as AdminAlertController;
use App\Http\Controllers\Api\V1\Admin\AuditLogController as AdminAuditLogController;
use App\Http\Controllers\Api\V1\Admin\MessageController as AdminMessageController;
use App\Http\Controllers\Api\V1\Admin\OverviewController as AdminOverviewController;
use App\Http\Controllers\Api\V1\Admin\PaymentController as AdminPaymentController;
use App\Http\Controllers\Api\V1\Admin\PlanController as AdminPlanController;
use App\Http\Controllers\Api\V1\Admin\PlatformPageController as AdminPlatformPageController;
use App\Http\Controllers\Api\V1\Admin\SupportController as AdminSupportController;
use App\Http\Controllers\Api\V1\Admin\TenantBillingController as AdminTenantBillingController;
use App\Http\Controllers\Api\V1\Admin\TenantController as AdminTenantController;
use App\Http\Controllers\Api\V1\Admin\ThemeController as AdminThemeController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\Dashboard\AbTestController;
use App\Http\Controllers\Api\V1\Dashboard\AccountController;
use App\Http\Controllers\Api\V1\Dashboard\AiDesignerController;
use App\Http\Controllers\Api\V1\Dashboard\AiSectionController;
use App\Http\Controllers\Api\V1\Dashboard\AiWalletController;
use App\Http\Controllers\Api\V1\Dashboard\AnalyticsController;
use App\Http\Controllers\Api\V1\Dashboard\BillingController;
use App\Http\Controllers\Api\V1\Dashboard\BlockedCustomerController;
use App\Http\Controllers\Api\V1\Dashboard\CarrierAccountController;
use App\Http\Controllers\Api\V1\Dashboard\CartRecoveryController;
use App\Http\Controllers\Api\V1\Dashboard\CategoryController;
use App\Http\Controllers\Api\V1\Dashboard\CopilotChangeController;
use App\Http\Controllers\Api\V1\Dashboard\CopilotController;
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
use App\Http\Controllers\Api\V1\Dashboard\OrderConfirmationController;
use App\Http\Controllers\Api\V1\Dashboard\OrderController;
use App\Http\Controllers\Api\V1\Dashboard\OrderDeliveryController;
use App\Http\Controllers\Api\V1\Dashboard\OrderPaymentController;
use App\Http\Controllers\Api\V1\Dashboard\OrderUploadController;
use App\Http\Controllers\Api\V1\Dashboard\OverviewController;
use App\Http\Controllers\Api\V1\Dashboard\PageController;
use App\Http\Controllers\Api\V1\Dashboard\PixelController;
use App\Http\Controllers\Api\V1\Dashboard\PricingController;
use App\Http\Controllers\Api\V1\Dashboard\ProductCodeController;
use App\Http\Controllers\Api\V1\Dashboard\ProductController;
use App\Http\Controllers\Api\V1\Dashboard\ProductFileController;
use App\Http\Controllers\Api\V1\Dashboard\ProductImportController;
use App\Http\Controllers\Api\V1\Dashboard\ProfitController;
use App\Http\Controllers\Api\V1\Dashboard\RefundController;
use App\Http\Controllers\Api\V1\Dashboard\ReviewController;
use App\Http\Controllers\Api\V1\Dashboard\SetupSkipController;
use App\Http\Controllers\Api\V1\Dashboard\ShipmentController;
use App\Http\Controllers\Api\V1\Dashboard\ShippingCompanyController;
use App\Http\Controllers\Api\V1\Dashboard\ShippingController;
use App\Http\Controllers\Api\V1\Dashboard\ShippingOfferController;
use App\Http\Controllers\Api\V1\Dashboard\StaffController;
use App\Http\Controllers\Api\V1\Dashboard\StoreAnalyticsController;
use App\Http\Controllers\Api\V1\Dashboard\StoreController;
use App\Http\Controllers\Api\V1\Dashboard\StoreDesignController;
use App\Http\Controllers\Api\V1\Dashboard\StoreMailController;
use App\Http\Controllers\Api\V1\Dashboard\StorePageController;
use App\Http\Controllers\Api\V1\Dashboard\StorePaymentController;
use App\Http\Controllers\Api\V1\Dashboard\SupportController;
use App\Http\Controllers\Api\V1\Dashboard\ThemeStoreController;
use App\Http\Controllers\Api\V1\Dashboard\UpsellController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PlatformPageController;
use App\Http\Controllers\Api\V1\PricingPageController;
use App\Http\Controllers\Api\V1\Public\DeliveryController as PublicDeliveryController;
use App\Http\Controllers\Api\V1\Public\EventController;
use App\Http\Controllers\Api\V1\Public\OrderController as PublicOrderController;
use App\Http\Controllers\Api\V1\Public\PaymentController as PublicPaymentController;
use App\Http\Controllers\Api\V1\Public\RecoveryController as PublicRecoveryController;
use App\Http\Controllers\Api\V1\Public\SiteController;
use App\Http\Controllers\Api\V1\Public\StoreAccountController;
use App\Http\Controllers\Api\V1\Public\StoreController as PublicStoreController;
use App\Http\Controllers\Api\V1\Public\TrackController;
use App\Http\Controllers\Api\V1\Public\UploadController as PublicUploadController;
use App\Http\Controllers\Api\V1\Webhooks\ShippingWebhookController;
use App\Http\Controllers\Api\V1\Webhooks\StorePaymentWebhookController;
use App\Http\Controllers\Api\V1\Webhooks\WhatsAppWebhookController;
use App\Http\Controllers\Api\V1\Webhooks\XPayWebhookController;
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
    Route::post('password/code', [AuthController::class, 'passwordCode'])->middleware('throttle:password-code');
    Route::post('password/reset', [AuthController::class, 'passwordReset'])->middleware('throttle:password-reset');
    // A new staff member sets his password from the invitation link.
    Route::post('invitation/check', [AuthController::class, 'invitation'])->middleware('throttle:password-reset');
    Route::post('invitation/accept', [AuthController::class, 'acceptInvitation'])->middleware('throttle:password-reset');

    Route::middleware(['auth:sanctum', 'tenant.active'])->group(function (): void {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});

Route::prefix('dashboard')
    ->middleware(['auth:sanctum', 'tenant.user', 'tenant.active', 'staff.can', 'plan.writable', 'throttle:dashboard'])
    ->group(function (): void {
        // The owner's own account stays editable on an expired plan.
        Route::patch('profile', [AccountController::class, 'updateProfile'])->withoutMiddleware('plan.writable');
        Route::put('profile/password', [AccountController::class, 'updatePassword'])->withoutMiddleware('plan.writable');
        // The bell and where notifications go: also on an expired plan.
        Route::get('notifications', [NotificationController::class, 'index'])->withoutMiddleware('plan.writable');
        Route::post('notifications/read', [NotificationController::class, 'readAll'])->withoutMiddleware('plan.writable');
        Route::post('notifications/{notification}/read', [NotificationController::class, 'read'])->whereNumber('notification')->withoutMiddleware('plan.writable');
        Route::get('profile/notifications', [NotificationController::class, 'channel'])->withoutMiddleware('plan.writable');
        Route::put('profile/notifications', [NotificationController::class, 'updateChannel'])->withoutMiddleware('plan.writable');

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
            // Back from XPay's page: the session settled from XPay (docs: docs/plans or DECISIONS «XPay»).
            Route::post('billing/invoices/{invoice}/online', [InvoiceController::class, 'online'])->middleware('throttle:receipt-upload');
            Route::get('billing/invoices/{invoice}/payments/{payment}/receipt', [InvoiceController::class, 'receipt']);
            Route::post('billing/refund', [InvoiceController::class, 'refund']);
        });
        // The AI balance: seen (and topped up through the checkout) on an expired plan too.
        Route::get('ai/wallet', [AiWalletController::class, 'show'])->withoutMiddleware('plan.writable');
        Route::get('ai/wallet/entries', [AiWalletController::class, 'entries'])->withoutMiddleware('plan.writable');
        Route::get('ai/sections', [AiSectionController::class, 'index']);
        Route::delete('ai/sections/{aiSection}', [AiSectionController::class, 'destroy'])->whereNumber('aiSection');

        Route::prefix('ai/designer')->group(function (): void {
            Route::get('status', [AiDesignerController::class, 'status']);
            Route::post('chat', [AiDesignerController::class, 'chat']);
            Route::post('chat/new', [AiDesignerController::class, 'newChat']);
            Route::get('chats/{chat}', [AiDesignerController::class, 'showChat'])->whereNumber('chat');
            Route::post('chats/{chat}/messages', [AiDesignerController::class, 'sendMessage'])->whereNumber('chat')->middleware('throttle:support');
            Route::post('versions/{version}/approve', [AiDesignerController::class, 'approveVersion'])->whereNumber('version');
            Route::post('versions/{version}/reject', [AiDesignerController::class, 'rejectVersion'])->whereNumber('version');
            Route::post('messages/{message}/run', [AiDesignerController::class, 'startRun'])->whereNumber('message')->middleware('throttle:support');
            Route::get('runs/{run}', [AiDesignerController::class, 'showRun'])->whereNumber('run');
            Route::post('runs/{run}/apply', [AiDesignerController::class, 'applyRun'])->whereNumber('run');
            Route::post('runs/{run}/reject', [AiDesignerController::class, 'rejectRun'])->whereNumber('run');
            Route::post('runs/{run}/revert', [AiDesignerController::class, 'revertRun'])->whereNumber('run');
        });

        // The store copilot (docs/plans/ai-copilot.md §3.14).
        Route::prefix('ai/copilot')->group(function (): void {
            Route::get('status', [CopilotController::class, 'status']);
            Route::post('chat', [CopilotController::class, 'chat']);
            Route::post('chat/new', [CopilotController::class, 'newChat']);
            Route::get('chats/{chat}', [CopilotController::class, 'show'])->whereNumber('chat');
            Route::post('chats/{chat}/messages', [CopilotController::class, 'send'])->whereNumber('chat')->middleware('throttle:copilot');
            Route::post('attachments/sheet', [CopilotController::class, 'attachSheet'])->middleware('throttle:product-imports');
            Route::post('exports', [CopilotController::class, 'buildExport'])->middleware('throttle:orders-export');
            Route::get('exports/{token}', [CopilotController::class, 'downloadExport'])->where('token', '[A-Za-z0-9]{48}');
            Route::get('change-sets', [CopilotChangeController::class, 'index']);
            Route::get('change-sets/{changeSet}', [CopilotChangeController::class, 'show'])->whereNumber('changeSet');
            Route::get('change-sets/{changeSet}/items', [CopilotChangeController::class, 'items'])->whereNumber('changeSet');
            Route::get('change-sets/{changeSet}/items/file', [CopilotChangeController::class, 'itemsFile'])->whereNumber('changeSet')->middleware('throttle:orders-export');
            Route::post('change-sets/{changeSet}/accept', [CopilotChangeController::class, 'accept'])->whereNumber('changeSet');
            Route::post('change-sets/{changeSet}/reject', [CopilotChangeController::class, 'reject'])->whereNumber('changeSet');
            Route::post('change-sets/{changeSet}/revert', [CopilotChangeController::class, 'revert'])->whereNumber('changeSet');
        });

        Route::patch('store', [AccountController::class, 'updateStore']);

        Route::get('media', [MediaController::class, 'index']);
        Route::post('media', [MediaController::class, 'store'])->middleware('throttle:media-upload');
        Route::patch('media/{media}', [MediaController::class, 'update']);
        Route::delete('media/{media}', [MediaController::class, 'destroy']);

        Route::apiResource('identities', IdentityController::class);
        Route::post('identities/{identity}/make-default', [IdentityController::class, 'makeDefault']);

        // Support chat with the platform (conversations by their number). Open even when the plan has
        // expired: that is exactly when a store needs to ask about payment.
        Route::withoutMiddleware('plan.writable')->group(function (): void {
            Route::get('support/summary', [SupportController::class, 'summary']);
            Route::get('support/tickets', [SupportController::class, 'index']);
            Route::post('support/tickets', [SupportController::class, 'store'])->middleware('throttle:support');
            Route::get('support/tickets/{number}', [SupportController::class, 'show'])->whereNumber('number');
            Route::post('support/tickets/{number}/messages', [SupportController::class, 'message'])->whereNumber('number')->middleware('throttle:support');
            Route::post('support/tickets/{number}/read', [SupportController::class, 'read'])->whereNumber('number');
            Route::post('support/tickets/{number}/handoff', [SupportController::class, 'handOff'])->whereNumber('number');
            Route::post('support/tickets/{number}/close', [SupportController::class, 'close'])->whereNumber('number');
            Route::post('support/tickets/{number}/rating', [SupportController::class, 'rate'])->whereNumber('number');
            Route::get('support/attachments/{id}', [SupportController::class, 'attachment'])->whereNumber('id');
        });

        // Product import from a sheet (before the products resource so "imports" is not a product id).
        Route::get('product-imports', [ProductImportController::class, 'index']);
        Route::get('product-imports/template', [ProductImportController::class, 'template']);
        Route::post('product-imports', [ProductImportController::class, 'store'])->middleware('throttle:product-imports');
        Route::get('product-imports/{productImport}', [ProductImportController::class, 'show'])->whereNumber('productImport');
        Route::post('product-imports/{productImport}/start', [ProductImportController::class, 'start'])->whereNumber('productImport');
        Route::post('product-imports/{productImport}/cancel', [ProductImportController::class, 'cancel'])->whereNumber('productImport');
        Route::delete('product-imports/{productImport}', [ProductImportController::class, 'destroy'])->whereNumber('productImport');
        Route::get('product-imports/{productImport}/failures', [ProductImportController::class, 'failures'])->whereNumber('productImport');
        Route::get('product-imports/{productImport}/failures/file', [ProductImportController::class, 'failuresFile'])->whereNumber('productImport');
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
        Route::get('store/design/quiz-results', [StoreDesignController::class, 'quizResults']);
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
        Route::post('home/setup/{step}/skip', SetupSkipController::class);
        Route::get('analytics', AnalyticsController::class);
        // «الأرباح» (docs/plans/merchant-essentials.md, stage 3).
        Route::get('profit', [ProfitController::class, 'report']);
        Route::get('profit/settings', [ProfitController::class, 'settings']);
        Route::put('profit/settings', [ProfitController::class, 'updateSettings']);
        Route::get('profit/expenses', [ProfitController::class, 'expenses']);
        Route::post('profit/expenses', [ProfitController::class, 'storeExpense']);
        Route::put('profit/expenses/{expense}', [ProfitController::class, 'updateExpense'])->whereNumber('expense');
        Route::delete('profit/expenses/{expense}', [ProfitController::class, 'destroyExpense'])->whereNumber('expense');

        Route::get('ab-tests', [AbTestController::class, 'index']);
        Route::post('ab-tests', [AbTestController::class, 'store']);
        Route::post('ab-tests/{ab_test}/finish', [AbTestController::class, 'finish']);
        Route::delete('ab-tests/{ab_test}', [AbTestController::class, 'destroy']);

        Route::get('orders', [OrderController::class, 'index']);
        Route::get('orders/stats', [OrderController::class, 'stats']);
        Route::get('orders/confirmation-queue', [OrderController::class, 'confirmationQueue']);
        // WhatsApp confirmation (docs/plans/merchant-essentials.md, stage 2).
        Route::get('orders/confirmation-settings', [OrderConfirmationController::class, 'show']);
        Route::put('orders/confirmation-settings', [OrderConfirmationController::class, 'update']);
        Route::get('orders/export', [OrderController::class, 'export'])->middleware('throttle:orders-export');
        Route::post('orders/bulk-status', [OrderController::class, 'bulkStatus']);
        Route::get('orders/{order}', [OrderController::class, 'show']);
        Route::patch('orders/{order}', [OrderController::class, 'update']);
        Route::post('orders/{order}/status', [OrderController::class, 'changeStatus']);
        Route::post('orders/{order}/contact', [OrderController::class, 'contact']);
        Route::get('orders/{order}/uploads/{upload}', [OrderUploadController::class, 'show'])->whereNumber('upload');
        // A digital product's files and codes.
        Route::post('products/{product}/files', [ProductFileController::class, 'store']);
        Route::put('products/{product}/files/{file}', [ProductFileController::class, 'update'])->whereNumber('file');
        Route::delete('products/{product}/files/{file}', [ProductFileController::class, 'destroy'])->whereNumber('file');
        Route::get('products/{product}/codes', [ProductCodeController::class, 'index']);
        Route::post('products/{product}/codes', [ProductCodeController::class, 'store']);
        Route::put('products/{product}/codes/order', [ProductCodeController::class, 'reorder']);
        Route::put('products/{product}/codes/{code}', [ProductCodeController::class, 'update'])->whereNumber('code');
        Route::delete('products/{product}/codes/{code}', [ProductCodeController::class, 'destroy'])->whereNumber('code');
        // Prepaid orders: the customer's receipts (docs/plans/digital-products.md, stage 3).
        Route::get('orders/{order}/payments/{payment}/receipt', [OrderPaymentController::class, 'receipt'])->whereNumber('payment');
        Route::post('orders/{order}/payments/{payment}/approve', [OrderPaymentController::class, 'approve'])->whereNumber('payment');
        Route::post('orders/{order}/payments/{payment}/reject', [OrderPaymentController::class, 'reject'])->whereNumber('payment');
        // Refunds (docs/plans/merchant-essentials.md, stage 5).
        Route::get('refunds', [RefundController::class, 'index']);
        Route::post('orders/{order}/refunds', [RefundController::class, 'store']);
        Route::post('refunds/{refund}/complete', [RefundController::class, 'complete'])->whereNumber('refund');
        Route::post('refunds/{refund}/cancel', [RefundController::class, 'cancel'])->whereNumber('refund');
        Route::get('refunds/{refund}/proof', [RefundController::class, 'proof'])->whereNumber('refund');
        // Digital lines: send again, more downloads / opens, «تم التنفيذ» (docs/plans/digital-products.md, stage 4).
        Route::post('orders/{order}/deliveries/{delivery}/resend', [OrderDeliveryController::class, 'resend'])->whereNumber('delivery')->middleware('throttle:mail-checks');
        Route::post('orders/{order}/deliveries/{delivery}/grant', [OrderDeliveryController::class, 'grant'])->whereNumber('delivery');
        Route::post('orders/{order}/deliveries/{delivery}/complete', [OrderDeliveryController::class, 'complete'])->whereNumber('delivery');
        // Shipping orders through connected carriers (docs/plans/shipping-carriers.md).
        Route::get('orders/{order}/shipping', [ShipmentController::class, 'prepare']);
        Route::post('orders/{order}/shipments', [ShipmentController::class, 'store'])->middleware('throttle:carrier-calls');
        Route::post('shipments/bulk', [ShipmentController::class, 'bulk'])->middleware('throttle:carrier-calls');
        Route::get('shipments/labels', [ShipmentController::class, 'labels'])->middleware('throttle:carrier-calls');
        Route::post('shipments/{shipment}/cancel', [ShipmentController::class, 'cancel'])->middleware('throttle:carrier-calls');
        Route::post('shipments/{shipment}/refresh', [ShipmentController::class, 'refresh'])->middleware('throttle:carrier-calls');

        Route::get('reviews', [ReviewController::class, 'index']);
        Route::patch('reviews/{review}', [ReviewController::class, 'update']);
        Route::get('customers', [CustomerController::class, 'index']);
        Route::get('customers/{customer}', [CustomerController::class, 'show']);
        Route::patch('customers/{customer}', [CustomerController::class, 'update']);
        Route::post('customers/{customer}/block', [CustomerController::class, 'block']);

        Route::get('leads', [LeadController::class, 'index']);
        // Abandoned cart reminders and the WhatsApp message balance (docs/plans/merchant-essentials.md, stage 4).
        Route::get('leads/recovery', [CartRecoveryController::class, 'show']);
        Route::put('leads/recovery', [CartRecoveryController::class, 'update']);
        Route::get('leads/recovery/entries', [CartRecoveryController::class, 'entries']);
        Route::post('leads/recovery/remind', [CartRecoveryController::class, 'remind']);
        Route::patch('leads/{lead}', [LeadController::class, 'update']);
        Route::delete('leads/{lead}', [LeadController::class, 'destroy']);

        // «الدفع»: cash on delivery and the store's own prepaid methods.
        Route::get('payments', [StorePaymentController::class, 'show']);
        Route::put('payments/settings', [StorePaymentController::class, 'settings']);
        Route::post('payments/methods', [StorePaymentController::class, 'store']);
        Route::put('payments/methods/{method}', [StorePaymentController::class, 'update']);
        Route::delete('payments/methods/{method}', [StorePaymentController::class, 'destroy']);
        // Online payment with the store's own gateway account.
        Route::put('payments/gateways/{gateway}', [StorePaymentController::class, 'connect'])->where('gateway', '[a-z0-9_]{2,20}')->middleware('throttle:carrier-calls');
        Route::delete('payments/gateways/{gateway}', [StorePaymentController::class, 'disconnect'])->where('gateway', '[a-z0-9_]{2,20}');

        // «الإيميلات»: the store's customer emails (docs/plans/digital-products.md, stage 1).
        Route::get('mail-settings', [StoreMailController::class, 'show']);
        Route::put('mail-settings', [StoreMailController::class, 'update'])->middleware('throttle:mail-checks');
        Route::delete('mail-settings/mailbox', [StoreMailController::class, 'forget']);
        Route::post('mail-settings/test', [StoreMailController::class, 'test'])->middleware('throttle:mail-checks');

        // «الموظفين» and «سجل النشاط» (docs/plans/merchant-essentials.md, stage 1).
        Route::get('staff', [StaffController::class, 'index']);
        Route::get('staff/permissions', [StaffController::class, 'permissions']);
        Route::post('staff', [StaffController::class, 'store']);
        Route::put('staff/{staff}', [StaffController::class, 'update'])->whereNumber('staff');
        Route::post('staff/{staff}/toggle', [StaffController::class, 'toggle'])->whereNumber('staff');
        Route::post('staff/{staff}/resend', [StaffController::class, 'resend'])->whereNumber('staff')->middleware('throttle:mail-checks');
        Route::delete('staff/{staff}', [StaffController::class, 'destroy'])->whereNumber('staff');
        Route::get('activity', [StaffController::class, 'activity']);

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
        Route::get('shipping/carriers', [CarrierAccountController::class, 'index']);
        Route::post('shipping/carriers/{carrier}', [CarrierAccountController::class, 'connect'])->middleware('throttle:carrier-calls');
        Route::put('shipping/carriers/{carrier}', [CarrierAccountController::class, 'update']);
        Route::post('shipping/carriers/{carrier}/check', [CarrierAccountController::class, 'check'])->middleware('throttle:carrier-calls');
        Route::get('shipping/carriers/{carrier}/districts', [CarrierAccountController::class, 'districts']);
        Route::post('shipping/carriers/{carrier}/pickups', [CarrierAccountController::class, 'pickup'])->middleware('throttle:carrier-calls');
        Route::delete('shipping/carriers/{carrier}', [CarrierAccountController::class, 'destroy']);
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

// Provider webhooks, relayed by Next (raw body + the provider's signature, checked here).
Route::prefix('webhooks')
    ->middleware(['internal.key'])
    ->group(function (): void {
        Route::get('whatsapp', [WhatsAppWebhookController::class, 'verify']);
        Route::post('whatsapp', [WhatsAppWebhookController::class, 'receive']);
        Route::post('xpay', [XPayWebhookController::class, 'receive']);
        // A store's own gateway (Paymob, Kashier, XPay), one address per store account.
        Route::post('payments/{gateway}/{token}', [StorePaymentWebhookController::class, 'receive'])->where(['gateway' => '[a-z0-9_]{2,20}', 'token' => '[a-z0-9]{40}']);
        Route::post('shipping/{carrier}/{token}', [ShippingWebhookController::class, 'receive'])->where(['carrier' => '[a-z0-9_]{2,30}', 'token' => '[a-z0-9]{40}']);
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
        Route::get('track-link', [TrackController::class, 'link'])->middleware('throttle:public-track');
        // Cart reminder links: the short link, the refill, and «no more reminders».
        Route::get('recovery-link', [PublicRecoveryController::class, 'link'])->middleware('throttle:public-track');
        Route::get('recovery', [PublicRecoveryController::class, 'show'])->middleware('throttle:public-track');
        Route::post('recovery/unsubscribe', [PublicRecoveryController::class, 'unsubscribe'])->middleware('throttle:public-track');
        Route::post('upsell', [PublicOrderController::class, 'acceptUpsell'])->middleware('throttle:public-order-attempts');
        Route::post('leads', [PublicOrderController::class, 'lead'])->middleware('throttle:public-leads');
        // «حسب الطلب»: an image / file for a product field, before ordering (store and landing pages).
        Route::post('uploads', [PublicUploadController::class, 'store'])->middleware('throttle:public-uploads');
        // The pay page of a prepaid order (its private token): where to pay, and the receipt.
        Route::post('payments/lookup', [PublicPaymentController::class, 'show'])->middleware('throttle:public-track');
        Route::post('payments', [PublicPaymentController::class, 'store'])->middleware('throttle:public-uploads');
        Route::post('payments/online', [PublicPaymentController::class, 'online'])->middleware('throttle:public-track');
        // A buyer's downloads and link (the delivery's private token).
        Route::get('deliveries/{token}/files/{file}', [PublicDeliveryController::class, 'download'])->whereNumber('file')->middleware('throttle:public-downloads');
        Route::post('deliveries/{token}/open', [PublicDeliveryController::class, 'open'])->middleware('throttle:public-downloads');
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
        Route::post('store/quiz', [PublicStoreController::class, 'quiz'])->middleware('throttle:public-quiz');
        Route::post('store/quiz/advice', [PublicStoreController::class, 'quizAdvice'])->middleware('throttle:public-quiz');

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
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read', [NotificationController::class, 'readAll']);
        Route::post('notifications/{notification}/read', [NotificationController::class, 'read'])->whereNumber('notification');
        Route::get('alerts', [AdminAlertController::class, 'show']);
        Route::put('alerts', [AdminAlertController::class, 'update']);
        Route::post('alerts/test', [AdminAlertController::class, 'test'])->middleware('throttle:6,1');
        Route::get('audit-logs', [AdminAuditLogController::class, 'index']);
        Route::get('messages/overview', [AdminMessageController::class, 'overview']);
        Route::get('messages', [AdminMessageController::class, 'index']);
        Route::post('messages/templates', [AdminMessageController::class, 'pushTemplates'])->middleware('throttle:6,1');
        Route::get('tenants', [AdminTenantController::class, 'index']);
        Route::get('tenants/{tenant}', [AdminTenantController::class, 'show'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/suspend', [AdminTenantController::class, 'suspend'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/activate', [AdminTenantController::class, 'activate'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/reset-password', [AdminTenantController::class, 'resetPassword'])->whereNumber('tenant');
        Route::get('tenants/{tenant}/deletion', [AdminTenantController::class, 'deletionSummary'])->whereNumber('tenant');
        Route::delete('tenants/{tenant}', [AdminTenantController::class, 'destroy'])->whereNumber('tenant');
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

        Route::get('ai', [AdminAiController::class, 'show']);
        Route::put('ai/settings', [AdminAiController::class, 'update']);
        Route::get('tenants/{tenant}/ai-wallet', [AdminAiWalletController::class, 'show'])->whereNumber('tenant');
        Route::post('tenants/{tenant}/ai-wallet', [AdminAiWalletController::class, 'adjust'])->whereNumber('tenant');
        Route::get('ai/articles', [AdminAiArticleController::class, 'index']);
        Route::post('ai/articles', [AdminAiArticleController::class, 'store']);
        Route::put('ai/articles/{article}', [AdminAiArticleController::class, 'update'])->whereNumber('article');
        Route::delete('ai/articles/{article}', [AdminAiArticleController::class, 'destroy'])->whereNumber('article');

        Route::get('support/tickets', [AdminSupportController::class, 'index']);
        Route::get('support/unread', [AdminSupportController::class, 'unread']);
        Route::get('support/stats', [AdminSupportController::class, 'stats']);
        Route::get('support/tickets/{number}', [AdminSupportController::class, 'show'])->whereNumber('number');
        Route::post('support/tickets/{number}/messages', [AdminSupportController::class, 'message'])->whereNumber('number');
        Route::post('support/tickets/{number}/read', [AdminSupportController::class, 'read'])->whereNumber('number');
        Route::post('support/tickets/{number}/close', [AdminSupportController::class, 'close'])->whereNumber('number');
        Route::post('support/tickets/{number}/reopen', [AdminSupportController::class, 'reopen'])->whereNumber('number');
        Route::get('support/attachments/{id}', [AdminSupportController::class, 'attachment'])->whereNumber('id');

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
