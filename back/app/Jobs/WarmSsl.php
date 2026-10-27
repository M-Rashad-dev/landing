<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\SslStatus;
use App\Models\Domain;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Requests https://{host}/api/health with TLS verification on. The first request makes Caddy
 * issue the certificate (on-demand TLS). 6 tries, 20 s apart: success → issued, otherwise
 * unknown (often hairpin NAT on the server rather than a missing certificate).
 */
final class WarmSsl implements ShouldQueue
{
    use Queueable;

    public const ATTEMPTS = 6;

    public const DELAY_SECONDS = 20;

    public int $tries = self::ATTEMPTS;

    public function __construct(public readonly int $domainId) {}

    public function handle(): void
    {
        // Audited bypass: load by id, then write inside the domain's own tenant.
        $domain = Tenancy::withoutTenant(fn () => Domain::query()->find($this->domainId));

        if ($domain === null || ! $domain->isActive()) {
            return;
        }

        if ($this->reachable($domain->host)) {
            $this->record($domain, SslStatus::Issued);

            return;
        }

        if ($this->attempts() < self::ATTEMPTS) {
            $this->release(self::DELAY_SECONDS);

            return;
        }

        $this->record($domain, SslStatus::Unknown);
    }

    private function reachable(string $host): bool
    {
        // Production: https, no port. Local development uses PUBLIC_SCHEME/PUBLIC_PORT (plain reachability).
        $url = rtrim(PublicSite::url($host), '/').'/api/health';

        try {
            return Http::timeout(15)->connectTimeout(10)->get($url)->successful();
        } catch (Throwable) {
            return false;
        }
    }

    private function record(Domain $domain, SslStatus $status): void
    {
        Tenancy::runAs($domain->tenant_id, fn () => $domain->forceFill(['ssl_status' => $status, 'ssl_checked_at' => now()])->save());
    }
}
