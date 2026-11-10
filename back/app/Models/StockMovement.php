<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Why a stock number changed: an order took it, a cancel / return gave it back, or the
 * merchant edited it.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $product_id
 * @property int|null $variant_id
 * @property int $change
 * @property string $reason order | restock | manual
 * @property int|null $order_id
 */
class StockMovement extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $fillable = ['product_id', 'variant_id', 'change', 'reason', 'order_id'];

    protected function casts(): array
    {
        return ['change' => 'integer', 'created_at' => 'datetime'];
    }
}
