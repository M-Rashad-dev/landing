<?php

declare(strict_types=1);

namespace App\Providers;

use App\Ai\AiClient;
use App\Ai\FakeAiClient;
use App\Ai\Images\FakeStockPhotos;
use App\Ai\Images\PexelsStockPhotos;
use App\Ai\Images\StockPhotos;
use App\Ai\OpenRouterClient;
use App\Billing\Entitlements;
use App\Billing\Payments\XPay\FakeXPayClient;
use App\Billing\Payments\XPay\HttpXPayClient;
use App\Billing\Payments\XPay\XPayClient;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Mail\Store\FakeMailbox;
use App\Mail\Store\Mailbox;
use App\Mail\Store\SmtpMailbox;
use App\Messaging\WhatsApp\CloudWhatsAppGateway;
use App\Messaging\WhatsApp\WhatsAppGateway;
use App\Services\Dns\DnsResolver;
use App\Services\Dns\NativeDnsResolver;
use App\Shipping\Carriers\Carriers;
use App\Store\Accounts\CodeSender;
use App\Store\Accounts\ScreenCodeSender;
use App\Store\Accounts\WhatsAppCodeSender;
use App\Support\ArabicValidator;
use App\Tenancy\Tenancy;
use App\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(TenantContext::class);
        // Per-request memos over cached plan data (flushed by model events).
        $this->app->scoped(PlanCatalog::class);
        $this->app->scoped(PlatformSettings::class);
        $this->app->scoped(Entitlements::class);
        $this->app->scoped(ThemeCatalog::class);
        $this->app->scoped(ThemeAccess::class);
        $this->app->bind(DnsResolver::class, NativeDnsResolver::class);
        $this->app->bind(WhatsAppGateway::class, CloudWhatsAppGateway::class);
        // The AI provider (config/ai.php): the fake answers locally (tests, e2e) and is one instance, so a test can queue its answers.
        $this->app->singleton(AiClient::class, fn ($app): AiClient => config('ai.driver') === 'fake' ? new FakeAiClient : $app->make(OpenRouterClient::class));
        $this->app->singleton(StockPhotos::class, fn ($app): StockPhotos => config('ai.driver') === 'fake' ? new FakeStockPhotos : $app->make(PexelsStockPhotos::class));
        // Shipping carriers (config/shipping.php): one registry, so a test reads what the fake carrier was asked.
        $this->app->singleton(Carriers::class);
        // The merchant's own mailbox (config mail.store_mailbox): the fake is one instance, so a test reads what it sent.
        // XPay (online payment of invoices): the fake in tests and e2e, never the network.
        $this->app->singleton(XPayClient::class, fn ($app): XPayClient => config('services.xpay.driver') === 'fake' ? new FakeXPayClient : $app->make(HttpXPayClient::class));
        $this->app->singleton(Mailbox::class, fn ($app): Mailbox => config('mail.store_mailbox') === 'fake' ? new FakeMailbox : $app->make(SmtpMailbox::class));
        // Customer sign-in codes: WhatsApp once its keys are set, else on screen (refused in production).
        $this->app->bind(CodeSender::class, fn ($app): CodeSender => $app->make(WhatsAppGateway::class)->configured()
            ? $app->make(WhatsAppCodeSender::class)
            : $app->make(ScreenCodeSender::class));
    }

    public function boot(): void
    {
        // Arabic field names in every validation message (never a raw key).
        Validator::resolver(fn ($translator, array $data, array $rules, array $messages, array $attributes) => new ArabicValidator($translator, $data, $rules, $messages, $attributes));
        Model::preventLazyLoading($this->app->environment('local', 'testing'));
        Model::preventSilentlyDiscardingAttributes($this->app->environment('local', 'testing'));

        $this->configureRateLimiting();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(5)->by('register:'.$request->ip()));

        RateLimiter::for('password-code', fn (Request $request) => Limit::perHour(30)->by('password-code:'.$request->ip()));
        // Guessing is stopped by the code's own 5 attempts; this only slows scripts down.
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(10)->by('password-reset:'.$request->ip()));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            'login:'.$request->ip().'|'.mb_strtolower(trim((string) $request->input('login'))),
        ));

        RateLimiter::for('media-upload', fn (Request $request) => Limit::perMinute(30)->by(
            'media-upload:'.($request->user()?->tenant_id ?? $request->ip()),
        ));

        // Receipt uploads: 10 per hour per store.
        RateLimiter::for('receipt-upload', fn (Request $request) => Limit::perHour(10)->by('receipt-upload:'.($request->user()?->tenant_id ?? $request->ip())));
        RateLimiter::for('public-plans', fn (Request $request) => Limit::perMinute(60)->by('public-plans:'.$request->ip()));

        // Support: opening conversations and sending messages (files can be big).
        RateLimiter::for('support', fn (Request $request) => Limit::perMinute(20)->by('support:'.($request->user()?->getAuthIdentifier() ?? $request->ip())));
        // Messages to the store copilot (each one is paid AI work).
        RateLimiter::for('copilot', fn (Request $request) => Limit::perMinute(20)->by('copilot:'.($request->user()?->getAuthIdentifier() ?? $request->ip())));

        // Product sheet uploads are read in the request (columns, sample rows): a few per minute.
        RateLimiter::for('product-imports', fn (Request $request) => Limit::perMinute(10)->by('product-imports:'.($request->user()?->getAuthIdentifier() ?? $request->ip())));

        RateLimiter::for('dashboard', fn (Request $request) => Limit::perMinute(300)->by(
            'dashboard:'.($request->user()?->getAuthIdentifier() ?? $request->ip()),
        ));

        // Visitor endpoints: Next forwards the visitor's IP in the body (trusted: internal key only).
        $visitor = fn (Request $request): string => (string) ($request->input('ip') ?: $request->ip());
        RateLimiter::for('public-form-token', fn (Request $request) => Limit::perMinute(30)->by('public-form-token:'.$visitor($request)));
        // Tracking: order number + phone guesses are slowed down per visitor IP.
        RateLimiter::for('public-account-code', fn (Request $request) => Limit::perMinute(10)->by('public-account-code:'.$visitor($request)));
        RateLimiter::for('public-account', fn (Request $request) => Limit::perMinute(120)->by('public-account:'.$visitor($request)));
        RateLimiter::for('public-track', fn (Request $request) => Limit::perMinute(10)->by('public-track:'.$visitor($request)));
        RateLimiter::for('public-quote', fn (Request $request) => Limit::perMinute(60)->by('public-quote:'.$visitor($request)));
        // Loose guard on attempts; the real 5-per-10-min / 3-per-phone limits count orders (CreateOrder).
        RateLimiter::for('public-order-attempts', fn (Request $request) => Limit::perMinute(20)->by('public-order:'.$visitor($request)));
        // Abandoned-form captures: the form sends one per phone change, so this is generous but bounded.
        // «حسب الطلب» uploads (≤ 10 MB each): a few per product, bounded per visitor.
        RateLimiter::for('public-uploads', fn (Request $request) => Limit::perMinute(10)->by('public-uploads:'.$visitor($request)));
        // Digital downloads and link opens (each one counted against the purchase too).
        RateLimiter::for('public-downloads', fn (Request $request) => Limit::perMinute(30)->by('public-downloads:'.$visitor($request)));
        RateLimiter::for('public-leads', fn (Request $request) => Limit::perMinute(15)->by('public-leads:'.$visitor($request)));
        // Page visit counters: a few per page view (view + form start), generous per visitor IP.
        RateLimiter::for('public-events', fn (Request $request) => Limit::perMinute(120)->by('public-events:'.$visitor($request)));
        // "Send test" makes a real outgoing request: 10 per minute per store.
        RateLimiter::for('integration-tests', fn (Request $request) => Limit::perMinute(10)->by('integration-tests:'.(Tenancy::id() ?? $request->ip())));
        // Calls to a shipping carrier (ship, cancel, airway bills, connect): 60 per minute per store.
        RateLimiter::for('carrier-calls', fn (Request $request) => Limit::perMinute(60)->by('carrier-calls:'.(Tenancy::id() ?? $request->ip())));
        // «ابعت إيميل تجربة» / saving a mailbox log in to the merchant's mail server: 6 per minute per store.
        RateLimiter::for('mail-checks', fn (Request $request) => Limit::perMinute(6)->by('mail-checks:'.(Tenancy::id() ?? $request->ip())));
        RateLimiter::for('orders-export', fn (Request $request) => Limit::perMinute(10)->by('orders-export:'.($request->user()?->getAuthIdentifier() ?? $request->ip())));

        // Manual DNS / SSL re-checks: 10 per minute per tenant.
        RateLimiter::for('domain-checks', fn (Request $request) => Limit::perMinute(10)->by('domain-checks:'.(Tenancy::id() ?? $request->ip())));
        // Caddy on-demand TLS ask (Docker network only).
        RateLimiter::for('tls-ask', fn (Request $request) => Limit::perMinute(60)->by('tls-ask:'.$request->ip()));

        // Server-to-server reads from Next (cached there for 60 s), keyed by the visited host.
        RateLimiter::for('public-read', fn (Request $request) => Limit::perMinute(600)->by(
            'public-read:'.mb_strtolower((string) $request->query('host', '')),
        ));
    }
}
