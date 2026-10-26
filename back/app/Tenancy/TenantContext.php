<?php

declare(strict_types=1);

namespace App\Tenancy;

/**
 * Holds the tenant of the current request/job. Registered as a singleton.
 * When no tenant is set, tenant-scoped queries return nothing (fail-closed).
 */
final class TenantContext
{
    private ?int $tenantId = null;

    private int $bypassDepth = 0;

    public function id(): ?int
    {
        return $this->tenantId;
    }

    public function set(?int $tenantId): void
    {
        $this->tenantId = $tenantId;
    }

    public function clear(): void
    {
        $this->tenantId = null;
    }

    public function check(): bool
    {
        return $this->tenantId !== null;
    }

    public function isBypassed(): bool
    {
        return $this->bypassDepth > 0;
    }

    public function enterBypass(): void
    {
        $this->bypassDepth++;
    }

    public function leaveBypass(): void
    {
        $this->bypassDepth = max(0, $this->bypassDepth - 1);
    }
}
