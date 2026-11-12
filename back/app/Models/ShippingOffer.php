<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PromotionStatus;
use App\Enums\PromotionTarget;
use App\Enums\ShippingBenefit;
use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;

/**
 * Free or cheaper delivery when the order meets its conditions (pieces and / or total of the
 * covered products), optionally only for some governorates or companies.
 *
 * @property int $id
 * @property string $name
 * @property ShippingBenefit $benefit
 * @property string|null $value
 * @property int|null $min_quantity
 * @property string|null $min_total
 * @property PromotionTarget $applies_to
 * @property list<string>|null $governorates
 * @property list<int>|null $company_ids
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property bool $is_active
 */
class ShippingOffer extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'benefit', 'value', 'min_quantity', 'min_total', 'applies_to', 'governorates', 'company_ids', 'starts_at', 'ends_at', 'is_active'];

    protected function casts(): array
    {
        return [
            'benefit' => ShippingBenefit::class,
            'applies_to' => PromotionTarget::class,
            'value' => 'decimal:2',
            'min_total' => 'decimal:2',
            'min_quantity' => 'integer',
            'governorates' => 'array',
            'company_ids' => 'array',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'shipping_offer_products');
    }

    /** @return BelongsToMany<Category, $this> */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'shipping_offer_categories');
    }

    /** @param Builder<ShippingOffer> $query */
    public function scopeActiveAt(Builder $query, CarbonInterface $now): void
    {
        $query->where('is_active', true)
            ->where(fn (Builder $q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn (Builder $q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now));
    }

    public function statusAt(CarbonInterface $now): PromotionStatus
    {
        return PromotionStatus::compute($this->is_active, $this->starts_at, $this->ends_at, $now);
    }

    public function valueCents(): int
    {
        return $this->value === null ? 0 : Money::toCents((string) $this->value);
    }

    public function minTotalCents(): ?int
    {
        return $this->min_total === null ? null : Money::toCents((string) $this->min_total);
    }
}
