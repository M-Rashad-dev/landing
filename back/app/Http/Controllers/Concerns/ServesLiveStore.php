<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Exceptions\ApiException;
use App\Models\Store;
use App\Models\Tenant;
use App\Services\PublicSite;
use App\Store\StoreSite;
use App\Tenancy\Tenancy;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Visitor-facing store endpoints (Next calls them server-side with the internal key): host →
 * tenant (sites open) → live store, then the callback runs in that tenant context. Never cached.
 */
trait ServesLiveStore
{
    /** @param Closure(Store, string): JsonResponse $callback */
    protected function inStore(Request $request, Closure $callback): JsonResponse
    {
        $site = app(PublicSite::class);
        $domain = $site->activeDomainOrFail((string) $request->input('host', $request->query('host', '')));
        $primary = $site->primaryHost($domain->tenant_id) ?? $domain->host;

        return Tenancy::runAs($domain->tenant_id, function () use ($domain, $callback, $primary) {
            $tenant = $domain->tenant ?? Tenant::query()->findOrFail($domain->tenant_id);
            $store = app(StoreSite::class)->live($tenant) ?? throw new ApiException(404, 'store_not_live', __('store.store_disabled'));

            return $callback($store, $primary)->header('Cache-Control', 'no-store, private');
        });
    }

    protected function noStore(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'no-store, private');
    }
}
