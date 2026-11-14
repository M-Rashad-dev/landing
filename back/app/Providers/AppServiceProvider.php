<?php

declare(strict_types=1);

namespace App\Providers;

use App\Billing\Entitlements;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Billing\Themes\ThemeAccess;
use App\Billing\Themes\ThemeCatalog;
use App\Services\Dns\DnsResolver;
use App\Services\Dns\NativeDnsResolver;
use App\Store\Accounts\CodeSender;
use App\Store\Accounts\ScreenCodeSender;
use App\Tenancy\Tenancy;
use App\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
        // Customer sign-in codes: only the on-screen sender until the owner picks WhatsApp / SMS providers.
        $this->app->bind(CodeSender::class, ScreenCodeSender::class);
    }

    public function boot(): void
    {
        Model::preventLazyLoading($this->app->environment('local', 'testing'));
        Model::preventSilentlyDiscardingAttributes($this->app->environment('local', 'testing'));

        $this->configureRateLimiting();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('register', fn (Request $request) => Limit::perHour(5)->by('register:'.$request->ip()));

        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            'login:'.$request->ip().'|'.mb_strtolower(trim((string) $request->input('login'))),
        ));

        RateLimiter::for('media-upload', fn (Request $request) => Limit::perMinute(30)->by(
            'media-upload:'.($request->user()?->tenant_id ?? $request->ip()),
        ));

        // Receipt uploads: 10 per hour per store.
        RateLimiter::for('receipt-upload', fn (Request $request) => Limit::perHour(10)->by('receipt-upload:'.($request->user()?->tenant_id ?? $request->ip())));
        RateLimiter::for('public-plans', fn (Request $request) => Limit::perMinute(60)->by('public-plans:'.$request->ip()));

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
        RateLimiter::for('public-leads', fn (Request $request) => Limit::perMinute(15)->by('public-leads:'.$visitor($request)));
        // Page visit counters: a few per page view (view + form start), generous per visitor IP.
        RateLimiter::for('public-events', fn (Request $request) => Limit::perMinute(120)->by('public-events:'.$visitor($request)));
        // "Send test" makes a real outgoing request: 10 per minute per store.
        RateLimiter::for('integration-tests', fn (Request $request) => Limit::perMinute(10)->by('integration-tests:'.(Tenancy::id() ?? $request->ip())));
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
