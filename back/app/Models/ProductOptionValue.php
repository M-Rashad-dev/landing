<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $option_id
 * @property string $label
 * @property string|null $color_hex
 * @property string $price_delta decimal string
 * @property bool $is_active
 * @property int $position
 */
class ProductOptionValue extends Model
{
    use BelongsToTenant;

    protected $fillable = ['option_id', 'label', 'color_hex', 'price_delta', 'is_active', 'position'];

    protected function casts(): array
    {
        return [
            'price_delta' => 'decimal:2',
            'is_active' => 'boolean',
            'position' => 'integer',
        ];
    }

    /** @return BelongsTo<ProductOption, $this> */
    public function option(): BelongsTo
    {
        return $this->belongsTo(ProductOption::class, 'option_id');
    }

    public function priceDeltaCents(): int
    {
        return Money::toCents($this->price_delta);
    }
}
