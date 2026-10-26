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

        RateLimiter::for('dashboard', fn (Request $request) => Limit::perMinute(300)->by(
            'dashboard:'.($request->user()?->getAuthIdentifier() ?? $request->ip()),
        ));
    }
}
