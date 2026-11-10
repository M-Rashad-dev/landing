<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\OfferType;
use App\Enums\PromotionStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use App\Support\Money;
use Carbon\CarbonInterface;
use Database\Factories\OfferFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property OfferType $type
 * @property string|null $value
 * @property int|null $bundle_quantity
 * @property string|null $bundle_price
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property bool $is_active
 * @property string|null $badge_text
 * @property int $priority
 * @property int $min_quantity
 * @property int|null $free_quantity
 * @property int|null $gift_product_id
 */
class Offer extends Model
{
    /** @use HasFactory<OfferFactory> */
    use BelongsToTenant, HasFactory, LockableByPlan, SoftDeletes;

    protected $fillable = ['name', 'type', 'value', 'bundle_quantity', 'bundle_price', 'starts_at', 'ends_at', 'is_active', 'badge_text', 'priority', 'min_quantity', 'free_quantity', 'gift_product_id'];

    protected function casts(): array
    {
        return [
            'type' => OfferType::class,
            'value' => 'decimal:2',
            'bundle_quantity' => 'integer',
            'bundle_price' => 'decimal:2',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
            'priority' => 'integer',
            'min_quantity' => 'integer',
            'free_quantity' => 'integer',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function giftProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'gift_product_id');
    }

    /** Quantity the customer orders to get this offer (shown in offer cards and the offer picker). */
    public function requiredQuantity(): int
    {
        return match ($this->type) {
            OfferType::Bundle => (int) $this->bundle_quantity,
            OfferType::BuyGet => max(1, $this->min_quantity) + (int) $this->free_quantity,
            default => max(1, $this->min_quantity),
        };
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'offer_products')->withTimestamps();
    }

    /**
     * Active at the given moment: is_active, started (or no start) and not ended (or no end).
     * Both bounds are inclusive.
     *
     * @param  Builder<Offer>  $query
     */
    public function scopeActiveAt(Builder $query, CarbonInterface $now): void
    {
        $query->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now));
    }

    /**
     * Not active yet but will start later (for "coming soon" display).
     *
     * @param  Builder<Offer>  $query
     */
    public function scopeUpcomingAt(Builder $query, CarbonInterface $now): void
    {
        $query->where('is_active', true)->where('starts_at', '>', $now);
    }

    public function statusAt(CarbonInterface $now): PromotionStatus
    {
        return PromotionStatus::compute($this->is_active, $this->starts_at, $this->ends_at, $now);
    }

    public function valueCents(): int
    {
        return Money::toCents($this->value);
    }

    public function bundlePriceCents(): int
    {
        return Money::toCents($this->bundle_price);
    }
}
