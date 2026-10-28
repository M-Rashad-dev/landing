<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Post-order offer (success screen): after an order for the trigger product (or any order),
 * offer another product at a special unit price, added to the same order in one click.
 *
 * @property int $id
 * @property string $name
 * @property int|null $trigger_product_id
 * @property int $offer_product_id
 * @property string $price
 * @property string $headline
 * @property string|null $description
 * @property bool $is_active
 * @property int $priority
 */
class Upsell extends Model
{
    use BelongsToTenant, SoftDeletes;

    protected $fillable = ['name', 'trigger_product_id', 'offer_product_id', 'price', 'headline', 'description', 'is_active', 'priority'];

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'is_active' => 'boolean', 'priority' => 'integer'];
    }

    public function priceCents(): int
    {
        return Money::toCents((string) $this->price);
    }

    /** @return BelongsTo<Product, $this> */
    public function triggerProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'trigger_product_id')->withTrashed();
    }

    /** @return BelongsTo<Product, $this> */
    public function offerProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'offer_product_id')->withTrashed();
    }

    /** @return HasMany<OrderItem, $this> */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
