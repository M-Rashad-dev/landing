<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ProductInputKind;
use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A «حسب الطلب» field of a product: the customer types a text or uploads an image / file when buying.
 *
 * @property int $id
 * @property int $product_id
 * @property ProductInputKind $kind
 * @property string $label
 * @property string|null $placeholder
 * @property bool $is_required
 * @property string $price_delta decimal string, added when the customer fills it
 * @property int $position
 */
class ProductInput extends Model
{
    use BelongsToTenant;

    /** Fields on one product. */
    public const MAX = 5;

    protected $fillable = ['product_id', 'kind', 'label', 'placeholder', 'is_required', 'price_delta', 'position'];

    protected function casts(): array
    {
        return [
            'kind' => ProductInputKind::class,
            'is_required' => 'boolean',
            'price_delta' => 'decimal:2',
            'position' => 'integer',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function priceDeltaCents(): int
    {
        return Money::toCents((string) $this->price_delta);
    }
}
