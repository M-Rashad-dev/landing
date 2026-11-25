<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One checkout a customer opened at the store's gateway to pay an order (App\Store\Payments\OnlineStorePayments).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $order_id
 * @property string $gateway
 * @property string $reference ours, the gateway's merchant order reference
 * @property string|null $external_id the gateway's checkout id
 * @property string $amount
 * @property string $status open | waiting | paid | failed | expired
 * @property string|null $payment_ref the gateway's transaction id
 * @property string|null $method card, wallet, kiosk… as the gateway reports it
 * @property bool $livemode
 * @property Carbon|null $paid_at
 * @property Carbon $created_at
 */
class StoreOnlinePayment extends Model
{
    use BelongsToTenant;

    public const OPEN = 'open';

    public const WAITING = 'waiting';

    public const PAID = 'paid';

    public const FAILED = 'failed';

    public const EXPIRED = 'expired';

    protected $fillable = ['order_id', 'gateway', 'reference', 'external_id', 'amount', 'status'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'livemode' => 'boolean', 'paid_at' => 'datetime'];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
