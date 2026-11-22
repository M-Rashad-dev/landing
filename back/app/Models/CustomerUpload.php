<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An image or file a customer uploaded on a «حسب الطلب» field (private disk). It waits with only its token until
 * an order claims it (order_item_id); unclaimed ones are deleted after a day (uploads:prune).
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $token
 * @property int|null $product_input_id
 * @property int|null $order_item_id
 * @property string $path
 * @property string $name
 * @property string $mime
 * @property int $size
 */
class CustomerUpload extends Model
{
    use BelongsToTenant;

    protected $fillable = ['token', 'product_input_id', 'order_item_id', 'path', 'name', 'mime', 'size'];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    /** @return BelongsTo<OrderItem, $this> */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
