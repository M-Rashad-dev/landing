<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\DomainStatus;
use App\Models\Domain;
use App\Services\DomainVerifier;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Background DNS check of one pending domain (dispatched by domains:verify-pending). */
final class VerifyDomain implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public readonly int $domainId) {}

    public function handle(DomainVerifier $verifier): void
    {
        // Audited bypass: load by id, then work inside the domain's own tenant.
        $domain = Tenancy::withoutTenant(fn () => Domain::query()->find($this->domainId));

        if ($domain === null || $domain->status !== DomainStatus::Pending) {
            return;
        }

        Tenancy::runAs($domain->tenant_id, fn () => $verifier->verify($domain));
    }
}
