<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\TenantStatus;
use App\Models\Domain;
use App\Models\Tenant;
use App\Services\DomainRules;
use App\Tenancy\Tenancy;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Caddy on-demand TLS gate: 200 only for platform hosts and active hosts of active tenants,
 * so nobody can make Caddy request certificates for random names. Read only.
 */
final class TlsAskController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $domain = DomainRules::normalize((string) $request->query('domain', ''));

        return response('', $domain !== '' && $this->allowed($domain) ? 200 : 404);
    }

    private function allowed(string $domain): bool
    {
        if (in_array($domain, DomainRules::platformHosts(), true)) {
            return true;
        }

        // Audited bypass: Caddy asks without a tenant; only an active host of an active tenant passes.
        $tenantId = Tenancy::withoutTenant(fn () => Domain::query()->where('active_host', $domain)->value('tenant_id'));

        return $tenantId !== null && Tenant::query()->whereKey($tenantId)->where('status', TenantStatus::Active)->exists();
    }
}
