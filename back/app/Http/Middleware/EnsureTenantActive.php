<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Rejects inactive users and suspended tenants. */
final class EnsureTenantActive
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user !== null && ! $user->is_active) {
            throw ApiException::forbidden('account_inactive', __('landing.account_inactive'));
        }

        if ($user?->tenant !== null && ! $user->tenant->isActive()) {
            throw ApiException::forbidden('tenant_suspended', __('landing.tenant_suspended'));
        }

        return $next($request);
    }
}
