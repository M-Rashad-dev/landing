<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A delivery company of the store: its default fee, and per governorate a different fee or "not served".
 *
 * @property int $id
 * @property string $name
 * @property int|null $media_id
 * @property int|null $delivery_days_min
 * @property int|null $delivery_days_max
 * @property string $default_fee
 * @property bool $is_active
 * @property int $position
 */
class ShippingCompany extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'media_id', 'delivery_days_min', 'delivery_days_max', 'default_fee', 'is_active', 'position'];

    protected function casts(): array
    {
        return [
            'default_fee' => 'decimal:2',
            'is_active' => 'boolean',
            'position' => 'integer',
            'delivery_days_min' => 'integer',
            'delivery_days_max' => 'integer',
        ];
    }

    /** @return HasMany<ShippingCompanyRate, $this> */
    public function rates(): HasMany
    {
        return $this->hasMany(ShippingCompanyRate::class);
    }

    /** @return BelongsTo<Media, $this> */
    public function logo(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'media_id');
    }

    public function defaultFeeCents(): int
    {
        return Money::toCents((string) $this->default_fee);
    }

    /**
     * Fee for a governorate in cents, or null when the company does not deliver there.
     * Needs `rates` loaded (or loads them).
     */
    public function feeFor(string $governorate): ?int
    {
        /** @var ShippingCompanyRate|null $rate */
        $rate = $this->rates->firstWhere('governorate', $governorate);
        if ($rate !== null && ! $rate->is_available) {
            return null;
        }

        return $rate?->fee === null ? $this->defaultFeeCents() : Money::toCents((string) $rate->fee);
    }
}
