<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\RefundMethod;
use App\Enums\RefundStatus;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Money going back to a customer for one order (docs/plans/merchant-essentials.md, stage 5). Changed only by
 * App\Orders\Refunds.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $order_id
 * @property string $amount
 * @property list<array{order_item_id: int, quantity: int}>|null $items
 * @property string|null $reason
 * @property RefundMethod $method
 * @property string|null $destination the customer's number / account
 * @property string|null $reference the transfer's reference
 * @property string|null $proof_path private disk
 * @property string|null $proof_mime
 * @property RefundStatus $status
 * @property bool $restock
 * @property bool $revoke_digital
 * @property Carbon|null $restocked_at
 * @property int|null $created_by
 * @property int|null $done_by
 * @property Carbon|null $done_at
 * @property int|null $cancelled_by
 * @property Carbon|null $cancelled_at
 * @property Carbon $created_at
 */
class OrderRefund extends Model
{
    use BelongsToTenant;

    protected $fillable = ['order_id', 'amount', 'items', 'reason', 'method', 'destination', 'reference', 'proof_path', 'proof_mime', 'status', 'restock', 'revoke_digital', 'created_by'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'items' => 'array',
            'method' => RefundMethod::class,
            'status' => RefundStatus::class,
            'restock' => 'boolean',
            'revoke_digital' => 'boolean',
            'restocked_at' => 'datetime',
            'done_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /** Quantity refunded per order line. @return array<int, int> */
    public function quantities(): array
    {
        $out = [];
        foreach ($this->items ?? [] as $line) {
            $out[(int) $line['order_item_id']] = ($out[(int) $line['order_item_id']] ?? 0) + (int) $line['quantity'];
        }

        return $out;
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function doer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'done_by');
    }
}
