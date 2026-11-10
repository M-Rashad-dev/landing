<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BillingPeriod;
use App\Enums\SubscriptionSource;
use App\Enums\SubscriptionStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One paid / trial / granted period of a plan. Rows may be queued (starts_at in the future).
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $plan_key
 * @property BillingPeriod|null $period
 * @property SubscriptionSource $source
 * @property SubscriptionStatus $status
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property string $amount_paid decimal string
 * @property string $currency
 * @property array<string, mixed>|null $snapshot
 * @property string|null $note
 * @property int|null $created_by
 * @property Carbon|null $refunded_at
 */
class Subscription extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'plan_key', 'period', 'source', 'status', 'starts_at', 'ends_at',
        'amount_paid', 'currency', 'snapshot', 'note', 'created_by', 'refunded_at',
    ];

    protected function casts(): array
    {
        return [
            'period' => BillingPeriod::class,
            'source' => SubscriptionSource::class,
            'status' => SubscriptionStatus::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'amount_paid' => 'decimal:2',
            'snapshot' => 'array',
            'refunded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Plan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_key', 'key');
    }

    /** Rows that can still give access (not replaced, refunded or cancelled). @param Builder<Subscription> $query */
    public function scopeLive(Builder $query): void
    {
        $query->where('status', SubscriptionStatus::Active);
    }

    /** @param Builder<Subscription> $query */
    public function scopeRunningAt(Builder $query, CarbonInterface $at): void
    {
        $query->where('status', SubscriptionStatus::Active)->where('starts_at', '<=', $at)->where('ends_at', '>', $at);
    }

    public function amountPaidCents(): int
    {
        return Money::toCents((string) $this->amount_paid);
    }
}
