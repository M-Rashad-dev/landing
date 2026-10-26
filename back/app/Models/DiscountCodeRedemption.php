<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One use of a code by an order. released_at is set when the order is
 * cancelled or marked fake (the use no longer counts).
 *
 * @property int $id
 * @property int $discount_code_id
 * @property int $order_id
 * @property string $phone
 * @property string $amount
 * @property Carbon|null $released_at
 */
class DiscountCodeRedemption extends Model
{
    use BelongsToTenant;

    protected $fillable = ['discount_code_id', 'order_id', 'phone', 'amount', 'released_at'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'released_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DiscountCode, $this> */
    public function discountCode(): BelongsTo
    {
        return $this->belongsTo(DiscountCode::class);
    }
}
