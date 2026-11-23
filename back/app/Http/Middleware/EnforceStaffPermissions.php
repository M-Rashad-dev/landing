<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Auth\PermissionCatalog;
use App\Exceptions\ApiException;
use App\Models\ActivityLog;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Symfony\Component\HttpFoundation\Response;

/**
 * Dashboard routes: a staff member needs the permission config/permissions.php gives the route (a route not listed
 * there is refused: fail-closed); the owner passes. Every successful change is written to the store's activity log.
 */
final class EnforceStaffPermissions
{
    private const PREFIX = 'api/v1/dashboard/';

    /** Changes not worth a log line (the person's own settings, chats). */
    private const QUIET = [PermissionCatalog::SELF, PermissionCatalog::ANY, 'copilot.use', 'support.use', 'design.ai'];

    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = $request->user();
        $route = $request->route();
        $permission = $route instanceof Route ? self::permissionFor($route) : null;

        if ($user?->isStaff()) {
            if ($user->locked_by_plan) {
                throw ApiException::forbidden('staff_locked', __('staff.locked'));
            }
            if ($permission === null || ! $user->allows($permission)) {
                throw ApiException::forbidden('permission_denied', __('staff.denied'));
            }
        }

        $response = $next($request);

        if ($user !== null && $user->tenant_id !== null && $response->isSuccessful() && in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true) && ! in_array($permission, self::QUIET, true)) {
            ActivityLog::record($user, $permission, $request, $route instanceof Route ? $route : null);
        }

        return $response;
    }

    /** "METHOD uri" as route:list prints it, without the dashboard prefix. */
    public static function keyFor(Route $route): string
    {
        $methods = implode('|', array_values(array_diff($route->methods(), ['HEAD'])));

        return $methods.' '.(str_starts_with($route->uri(), self::PREFIX) ? substr($route->uri(), strlen(self::PREFIX)) : $route->uri());
    }

    public static function permissionFor(Route $route): ?string
    {
        $map = (array) config('permissions.routes', []);

        return $map[self::keyFor($route)] ?? null;
    }
}
