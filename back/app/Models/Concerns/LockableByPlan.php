<?php

declare(strict_types=1);

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Rows above a plan limit after a downgrade keep their own status but are not served to
 * visitors (App\Billing\PlanLocks). Public code paths use servable(); the dashboard shows all.
 *
 * @property bool $locked_by_plan
 *
 * @mixin Model
 */
trait LockableByPlan
{
    public function initializeLockableByPlan(): void
    {
        $this->mergeCasts(['locked_by_plan' => 'boolean']);
    }

    /** @param Builder<static> $query */
    public function scopeServable(Builder $query): void
    {
        $query->where($this->qualifyColumn('locked_by_plan'), false);
    }

    public function isLockedByPlan(): bool
    {
        return (bool) $this->getAttribute('locked_by_plan');
    }
}
