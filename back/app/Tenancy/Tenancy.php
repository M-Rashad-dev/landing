<?php

declare(strict_types=1);

namespace App\Tenancy;

use Closure;

final class Tenancy
{
    public static function context(): TenantContext
    {
        return app(TenantContext::class);
    }

    public static function id(): ?int
    {
        return self::context()->id();
    }

    /**
     * Run a callback as the given tenant, restoring the previous tenant afterwards.
     *
     * @template T
     *
     * @param  Closure(): T  $callback
     * @return T
     */
    public static function runAs(int $tenantId, Closure $callback): mixed
    {
        $context = self::context();
        $previous = $context->id();
        $context->set($tenantId);

        try {
            return $callback();
        } finally {
            $context->set($previous);
        }
    }

    /**
     * Run a callback with the tenant filter disabled. Allowed only in the audited
     * places (admin, resolve-host, TLS ask, jobs/commands that pick tenants).
     *
     * @template T
     *
     * @param  Closure(): T  $callback
     * @return T
     */
    public static function withoutTenant(Closure $callback): mixed
    {
        $context = self::context();
        $context->enterBypass();

        try {
            return $callback();
        } finally {
            $context->leaveBypass();
        }
    }
}
