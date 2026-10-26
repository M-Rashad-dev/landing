<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Tenant;
use App\Services\FrontendRevalidator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Purges Next's cache for every active host of a tenant (plus optional extra
 * hosts, e.g. a subdomain that was just renamed). Without it, pages refresh
 * within 60 s anyway thanks to `revalidate: 60`.
 */
final class RevalidateTenantHosts implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @param list<string> $extraHosts */
    public function __construct(
        public readonly int $tenantId,
        public readonly array $extraHosts = [],
    ) {}

    /** @return list<int> */
    public function backoff(): array
    {
        return [5, 20, 60];
    }

    public function handle(FrontendRevalidator $revalidator): void
    {
        $tenant = Tenant::query()->find($this->tenantId);
        $hosts = array_merge($tenant?->activeHosts() ?? [], $this->extraHosts);

        try {
            $revalidator->revalidateHosts($hosts);
        } catch (Throwable $e) {
            Log::warning('revalidate failed, will retry', ['tenant_id' => $this->tenantId, 'error' => $e->getMessage()]);

            throw $e;
        }
    }

    public function failed(?Throwable $e): void
    {
        Log::warning('revalidate gave up; pages refresh within 60s', ['tenant_id' => $this->tenantId, 'error' => $e?->getMessage()]);
    }
}
