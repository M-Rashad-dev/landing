<?php

declare(strict_types=1);

namespace App\Actions\Domains;

use App\Enums\DomainType;
use App\Enums\SslStatus;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Jobs\WarmSsl;
use App\Models\Domain;
use App\Services\PublicSite;
use Illuminate\Support\Facades\DB;

/** make-primary, delete and SSL re-check (phase 10, step 10). One primary per tenant. */
final class ManageDomain
{
    public function makePrimary(Domain $domain): Domain
    {
        if (! $domain->isActive()) {
            throw new ApiException(422, 'domain_not_active', __('domains.not_active'));
        }

        DB::transaction(function () use ($domain): void {
            Domain::query()->whereKeyNot($domain->id)->where('is_primary', true)->update(['is_primary' => false]);
            $domain->forceFill(['is_primary' => true])->save();
        });

        // Other hosts now redirect to the new primary.
        RevalidateTenantHosts::dispatch($domain->tenant_id);

        return $domain;
    }

    /** Custom domains only; deleting the primary hands it back to the free subdomain. */
    public function delete(Domain $domain): void
    {
        if ($domain->type !== DomainType::Custom) {
            throw new ApiException(422, 'subdomain_delete', __('domains.subdomain_delete'));
        }

        $host = $domain->host;
        DB::transaction(function () use ($domain): void {
            $wasPrimary = $domain->is_primary;
            $domain->delete();

            if ($wasPrimary) {
                Domain::query()->where('type', DomainType::Subdomain)->update(['is_primary' => true]);
            }
        });

        // The bulk update above fires no model event; drop the cached primary host explicitly.
        PublicSite::forget([$host], $domain->tenant_id);
        RevalidateTenantHosts::dispatch($domain->tenant_id, [$host]);
    }

    public function checkSsl(Domain $domain): Domain
    {
        if (! $domain->isActive()) {
            throw new ApiException(422, 'domain_not_active', __('domains.not_active'));
        }

        $domain->forceFill(['ssl_status' => SslStatus::Pending, 'ssl_checked_at' => null])->save();
        WarmSsl::dispatch($domain->id);

        return $domain->refresh();
    }
}
