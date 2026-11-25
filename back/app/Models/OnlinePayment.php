<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A checkout session a merchant opened to pay a platform invoice online (App\Billing\Payments\OnlinePayments).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $invoice_id
 * @property string $gateway xpay
 * @property string $method_key the payment method chosen (payment_methods.key)
 * @property string $external_id the gateway's session id
 * @property string $amount
 * @property string $status open | waiting | paid | failed | expired
 * @property string|null $payment_ref
 * @property bool $livemode
 * @property Carbon|null $paid_at
 */
class OnlinePayment extends Model
{
    use BelongsToTenant;

    public const OPEN = 'open';

    /** Checkout done with a pay-later method (Fawry reference): the money isn't in yet. */
    public const WAITING = 'waiting';

    public const PAID = 'paid';

    public const FAILED = 'failed';

    public const EXPIRED = 'expired';

    protected $fillable = ['invoice_id', 'gateway', 'method_key', 'external_id', 'amount', 'status'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'livemode' => 'boolean', 'paid_at' => 'datetime'];
    }

    /** @return BelongsTo<Invoice, $this> */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
