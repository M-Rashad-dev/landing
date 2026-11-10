<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\PlanCatalog;
use App\Enums\BillingPeriod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $plan_key
 * @property BillingPeriod $period
 * @property string $price decimal string
 * @property int $discount_percent
 * @property Carbon|null $discount_starts_at
 * @property Carbon|null $discount_ends_at
 * @property bool $is_active
 */
class PlanPrice extends Model
{
    protected $fillable = ['plan_key', 'period', 'price', 'discount_percent', 'discount_starts_at', 'discount_ends_at', 'is_active'];

    protected function casts(): array
    {
        return [
            'period' => BillingPeriod::class,
            'price' => 'decimal:2',
            'discount_percent' => 'integer',
            'discount_starts_at' => 'datetime',
            'discount_ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => PlanCatalog::flush());
        static::deleted(fn () => PlanCatalog::flush());
    }

    /** @return BelongsTo<Plan, $this> */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class, 'plan_key', 'key');
    }
}
