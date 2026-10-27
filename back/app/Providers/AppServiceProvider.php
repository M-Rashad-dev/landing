<?php

declare(strict_types=1);

namespace App\Providers;

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

        RateLimiter::for('dashboard', fn (Request $request) => Limit::perMinute(300)->by(
            'dashboard:'.($request->user()?->getAuthIdentifier() ?? $request->ip()),
        ));

        // Visitor endpoints: Next forwards the visitor's IP in the body (trusted: internal key only).
        $visitor = fn (Request $request): string => (string) ($request->input('ip') ?: $request->ip());
        RateLimiter::for('public-quote', fn (Request $request) => Limit::perMinute(60)->by('public-quote:'.$visitor($request)));
        // Loose guard on attempts; the real 5-per-10-min / 3-per-phone limits count orders (CreateOrder).
        RateLimiter::for('public-order-attempts', fn (Request $request) => Limit::perMinute(20)->by('public-order:'.$visitor($request)));
        RateLimiter::for('orders-export', fn (Request $request) => Limit::perMinute(10)->by('orders-export:'.($request->user()?->getAuthIdentifier() ?? $request->ip())));

        // Server-to-server reads from Next (cached there for 60 s), keyed by the visited host.
        RateLimiter::for('public-read', fn (Request $request) => Limit::perMinute(600)->by(
            'public-read:'.mb_strtolower((string) $request->query('host', '')),
        ));
    }
}
