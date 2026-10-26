<?php

declare(strict_types=1);

namespace App\Tenancy;

use RuntimeException;

final class MissingTenantException extends RuntimeException
{
    public static function forModel(string $model): self
    {
        return new self("Cannot create [{$model}] without a tenant: no tenant in context and tenant_id is empty.");
    }
}
