<?php

declare(strict_types=1);

use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\EnsureInternalKey;
use App\Http\Middleware\EnsurePlanWritable;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\EnsureTenantActive;
use App\Http\Middleware\ResolveTenantFromUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        commands: __DIR__.'/../routes/console.php',
        using: function (): void {
            Route::prefix('api/v1')
                ->middleware('api')
                ->group(base_path('routes/api.php'));

            // Docker-network only (health, Caddy TLS ask, local media). No /api/v1 prefix.
            Route::middleware('api')
                ->group(base_path('routes/internal.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant.user' => ResolveTenantFromUser::class,
            'tenant.active' => EnsureTenantActive::class,
            'internal.key' => EnsureInternalKey::class,
            'super.admin' => EnsureSuperAdmin::class,
            'plan.writable' => EnsurePlanWritable::class,
        ]);

        // The tenant must be known before route-model binding runs (bound ids are tenant-scoped).
        $middleware->prependToPriorityList(SubstituteBindings::class, ResolveTenantFromUser::class);

        // API-only app: unauthenticated requests get a JSON 401, never a redirect.
        $middleware->redirectGuestsTo(fn () => null);
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => ApiExceptionRenderer::shouldRender($request));
        $exceptions->render(new ApiExceptionRenderer);
        $exceptions->dontFlash(['password', 'password_confirmation', 'current_password', 'token']);
    })->create();
