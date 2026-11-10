<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Billing\Entitlements;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Expired subscription = read-only dashboard: reads pass, every write is refused with
 * subscription_expired. Routes the merchant needs to pay or leave opt out with
 * withoutMiddleware('plan.writable').
 */
final class EnsurePlanWritable
{
    public function __construct(private readonly Entitlements $entitlements) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethodSafe() && ! $this->entitlements->current()->isOpen()) {
            throw ApiException::subscriptionExpired();
        }

        return $next($request);
    }
}
