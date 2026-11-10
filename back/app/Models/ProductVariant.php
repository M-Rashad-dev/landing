<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Stock of one combination of a product's required options (e.g. red × M), used when the
 * product's stock_mode is "variant". combination_key = sorted option value ids joined by "-".
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $product_id
 * @property string $combination_key
 * @property string|null $sku
 * @property int $stock
 */
class ProductVariant extends Model
{
    use BelongsToTenant;

    protected $fillable = ['product_id', 'combination_key', 'sku', 'stock'];

    protected function casts(): array
    {
        return ['stock' => 'integer'];
    }

    /** @param list<int> $valueIds */
    public static function keyFor(array $valueIds): string
    {
        $ids = array_values(array_unique(array_map('intval', $valueIds)));
        sort($ids);

        return implode('-', $ids);
    }

    /** @return list<int> */
    public function valueIds(): array
    {
        return array_map('intval', array_filter(explode('-', $this->combination_key)));
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
