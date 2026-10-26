<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard\Concerns;

use App\Enums\PromotionStatus;
use Illuminate\Database\Eloquent\Builder;

/** ?status=inactive|scheduled|active|expired in SQL (same rules as PromotionStatus::compute). */
trait FiltersPromotionStatus
{
    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     */
    protected function filterStatus(Builder $query, ?string $status): void
    {
        $now = now();

        match (PromotionStatus::tryFrom((string) $status)) {
            PromotionStatus::Inactive => $query->where('is_active', false),
            PromotionStatus::Expired => $query->where('is_active', true)->whereNotNull('ends_at')->where('ends_at', '<', $now),
            PromotionStatus::Scheduled => $query->where('is_active', true)->whereNotNull('starts_at')->where('starts_at', '>', $now)
                ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now)),
            PromotionStatus::Active => $query->where('is_active', true)
                ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
                ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now)),
            null => null,
        };
    }
}
