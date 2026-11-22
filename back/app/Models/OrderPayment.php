<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A receipt the customer sent for a prepaid order (private disk), and the merchant's answer.
 *
 * @property int $id
 * @property int $order_id
 * @property int|null $store_payment_method_id
 * @property string $method_name
 * @property string $amount
 * @property string|null $sender_ref the number / name it was sent from
 * @property string $receipt_path
 * @property string $receipt_mime
 * @property string $status pending | approved | rejected
 * @property string|null $reject_reason
 * @property int|null $reviewed_by
 * @property Carbon|null $reviewed_at
 * @property Carbon $created_at
 */
class OrderPayment extends Model
{
    use BelongsToTenant;

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REJECTED = 'rejected';

    protected $fillable = ['order_id', 'store_payment_method_id', 'method_name', 'amount', 'sender_ref', 'receipt_path', 'receipt_mime', 'status', 'reject_reason', 'reviewed_by', 'reviewed_at'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'reviewed_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
