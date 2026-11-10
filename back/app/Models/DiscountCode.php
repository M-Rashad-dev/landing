<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DiscountType;
use App\Enums\PromotionStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use App\Support\Money;
use Carbon\CarbonInterface;
use Database\Factories\DiscountCodeFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property DiscountType $type
 * @property string $value
 * @property string|null $max_discount
 * @property string|null $min_order_total
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property int|null $usage_limit
 * @property int|null $usage_limit_per_phone
 * @property int $used_count
 * @property bool $stackable_with_offers
 * @property bool $is_active
 */
class DiscountCode extends Model
{
    /** @use HasFactory<DiscountCodeFactory> */
    use BelongsToTenant, HasFactory, LockableByPlan, SoftDeletes;

    protected $fillable = [
        'code', 'type', 'value', 'max_discount', 'min_order_total', 'starts_at', 'ends_at',
        'usage_limit', 'usage_limit_per_phone', 'stackable_with_offers', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'type' => DiscountType::class,
            'value' => 'decimal:2',
            'max_discount' => 'decimal:2',
            'min_order_total' => 'decimal:2',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'usage_limit' => 'integer',
            'usage_limit_per_phone' => 'integer',
            'used_count' => 'integer',
            'stackable_with_offers' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public static function normalizeCode(string $code): string
    {
        return strtoupper((string) preg_replace('/\s+/', '', $code));
    }

    public function setCodeAttribute(string $value): void
    {
        $this->attributes['code'] = self::normalizeCode($value);
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'discount_code_products')->withTimestamps();
    }

    /** @return HasMany<DiscountCodeRedemption, $this> */
    public function redemptions(): HasMany
    {
        return $this->hasMany(DiscountCodeRedemption::class);
    }

    public function statusAt(CarbonInterface $now): PromotionStatus
    {
        return PromotionStatus::compute($this->is_active, $this->starts_at, $this->ends_at, $now);
    }

    public function valueCents(): int
    {
        return Money::toCents($this->value);
    }

    public function maxDiscountCents(): ?int
    {
        return $this->max_discount === null ? null : Money::toCents($this->max_discount);
    }

    public function minOrderTotalCents(): ?int
    {
        return $this->min_order_total === null ? null : Money::toCents($this->min_order_total);
    }

    public function remaining(): ?int
    {
        return $this->usage_limit === null ? null : max(0, $this->usage_limit - $this->used_count);
    }
}
