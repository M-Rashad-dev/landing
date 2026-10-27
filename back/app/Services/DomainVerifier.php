<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\DomainStatus;
use App\Enums\SslStatus;
use App\Jobs\RevalidateTenantHosts;
use App\Jobs\WarmSsl;
use App\Models\Domain;
use App\Services\Dns\DnsResolver;
use App\Tenancy\Tenancy;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/** Checks a custom domain's DNS and activates it (phase 10, steps 3 and 5). */
final class DomainVerifier
{
    public function __construct(private readonly DnsResolver $dns) {}

    /** Null when the host points at the platform, otherwise an Arabic reason. */
    public function check(string $host): ?string
    {
        $cnames = $this->dns->cnameTargets($host);
        if (in_array((string) config('landing.cname_target'), $cnames, true)) {
            return null;
        }

        // Any matching A record passes, which also covers CNAME flattening at the apex.
        $ips = $this->dns->ipv4($host);
        if (in_array((string) config('landing.server_ip'), $ips, true)) {
            return null;
        }

        if ($ips !== []) {
            return __('domains.points_elsewhere', ['value' => implode('، ', $ips)]);
        }
        if ($cnames !== []) {
            return __('domains.points_elsewhere', ['value' => $cnames[0]]);
        }

        return __('domains.record_not_found');
    }

    /**
     * Runs the DNS check, records it and activates the domain when it passes.
     * Must run inside the domain's tenant (dashboard request or Tenancy::runAs in jobs).
     */
    public function verify(Domain $domain): Domain
    {
        if ($domain->isActive()) {
            return $domain;
        }

        $error = $this->check($domain->host);
        $domain->forceFill([
            'last_checked_at' => now(),
            'check_attempts' => $domain->check_attempts + 1,
            'last_check_error' => $error,
        ])->save();

        if ($error === null && $this->activate($domain)) {
            WarmSsl::dispatch($domain->id);
            RevalidateTenantHosts::dispatch($domain->tenant_id);
        }

        return $domain;
    }

    /** Second account to verify the same host loses (row lock + unique active_host). */
    private function activate(Domain $domain): bool
    {
        try {
            $activated = DB::transaction(function () use ($domain): bool {
                // Audited bypass: active hosts are unique platform-wide; lock whoever holds this one.
                $taken = Tenancy::withoutTenant(fn () => Domain::query()
                    ->where('active_host', $domain->host)
                    ->whereKeyNot($domain->id)
                    ->lockForUpdate()
                    ->exists());

                if ($taken) {
                    return false;
                }

                $domain->forceFill([
                    'status' => DomainStatus::Active,
                    'active_host' => $domain->host,
                    'verified_at' => now(),
                    'last_check_error' => null,
                    'ssl_status' => SslStatus::Pending,
                    'ssl_checked_at' => null,
                ])->save();

                return true;
            }, 3);
        } catch (UniqueConstraintViolationException) {
            $activated = false;
        }

        if (! $activated) {
            $domain->refresh()->forceFill(['last_check_error' => __('domains.host_taken')])->save();
        }

        return $activated;
    }
}
