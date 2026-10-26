<?php

declare(strict_types=1);

namespace App\Tenancy;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Fail-closed tenant filter: with a known tenant it adds `table.tenant_id = ?`,
 * otherwise it adds `1 = 0`. Only Tenancy::withoutTenant() skips it.
 */
final class TenantScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        $context = app(TenantContext::class);

        if ($context->isBypassed()) {
            return;
        }

        if ($context->check()) {
            $builder->where($model->qualifyColumn('tenant_id'), $context->id());

            return;
        }

        $builder->whereRaw('1 = 0');
    }
}
