<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\OptionDisplayType;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $product_id
 * @property string $name
 * @property OptionDisplayType $display_type
 * @property bool $is_required
 * @property int $position
 */
class ProductOption extends Model
{
    use BelongsToTenant;

    protected $fillable = ['product_id', 'name', 'display_type', 'is_required', 'position'];

    protected function casts(): array
    {
        return [
            'display_type' => OptionDisplayType::class,
            'is_required' => 'boolean',
            'position' => 'integer',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return HasMany<ProductOptionValue, $this> */
    public function values(): HasMany
    {
        return $this->hasMany(ProductOptionValue::class, 'option_id')->orderBy('position')->orderBy('id');
    }
}
