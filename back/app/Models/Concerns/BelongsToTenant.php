<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use App\Models\Tenant;
use App\Tenancy\MissingTenantException;
use App\Tenancy\Tenancy;
use App\Tenancy\TenantScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @mixin Model
 */
trait BelongsToTenant
{
    public static function bootBelongsToTenant(): void
    {
        static::addGlobalScope(new TenantScope);

        static::creating(function (Model $model): void {
            if (empty($model->getAttribute('tenant_id'))) {
                $tenantId = Tenancy::id();

                if ($tenantId === null) {
                    throw MissingTenantException::forModel($model::class);
                }

                $model->setAttribute('tenant_id', $tenantId);
            }
        });
    }

    /**
     * @return BelongsTo<Tenant, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
