<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Dashboard routes: the tenant is the authenticated user's tenant. */
final class ResolveTenantFromUser
{
    public function __construct(private readonly TenantContext $context) {}

    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user === null || $user->tenant_id === null || $user->tenant === null) {
            throw ApiException::forbidden();
        }

        if (! $user->tenant->isActive()) {
            throw ApiException::forbidden('tenant_suspended', __('landing.tenant_suspended'));
        }

        $this->context->set($user->tenant_id);

        try {
            return $next($request);
        } finally {
            $this->context->clear();
        }
    }
}
