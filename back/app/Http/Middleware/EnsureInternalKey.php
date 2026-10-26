<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Public routes are only callable by Next with the shared X-Internal-Key. */
final class EnsureInternalKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('landing.internal_api_key');
        $given = (string) $request->header('X-Internal-Key', '');

        if ($expected === '' || $given === '' || ! hash_equals($expected, $given)) {
            throw new ApiException(401, 'unauthenticated', __('landing.unauthenticated'));
        }

        return $next($request);
    }
}
