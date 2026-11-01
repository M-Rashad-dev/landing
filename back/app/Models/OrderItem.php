<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $order_id
 * @property int|null $product_id
 * @property string $product_name
 * @property string $unit_price
 * @property int $quantity
 * @property list<array{option: string, value: string, price_delta: float}>|null $options
 * @property string $line_total
 */
class OrderItem extends Model
{
    use BelongsToTenant;

    protected $fillable = ['order_id', 'product_id', 'upsell_id', 'is_gift', 'product_name', 'unit_price', 'quantity', 'options', 'line_total'];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'quantity' => 'integer',
            'options' => 'array',
            'line_total' => 'decimal:2',
            'is_gift' => 'boolean',
        ];
    }
}
