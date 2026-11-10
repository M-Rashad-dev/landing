<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\BillingPeriod;
use App\Enums\InvoiceStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * What a merchant owes the platform for one plan period. Amounts are a snapshot taken when
 * the invoice is created (BillingPriceCalculator), never recalculated.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string|null $number
 * @property string $type
 * @property string|null $plan_key
 * @property BillingPeriod|null $period
 * @property string|null $theme_key
 * @property bool $starts_now
 * @property InvoiceStatus $status
 * @property string $subtotal decimal string
 * @property string $discount decimal string
 * @property string $credit decimal string
 * @property string $total decimal string
 * @property string $currency
 * @property array<string, mixed> $snapshot
 * @property Carbon|null $expires_at
 * @property Carbon|null $paid_at
 * @property int|null $subscription_id
 * @property Carbon|null $refund_requested_at
 * @property string|null $refund_reason
 * @property Carbon|null $refunded_at
 * @property string|null $refund_ref
 * @property Carbon|null $created_at
 */
class Invoice extends Model
{
    use BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'type', 'plan_key', 'period', 'theme_key', 'starts_now', 'status', 'subtotal', 'discount', 'credit', 'total',
        'currency', 'snapshot', 'expires_at', 'paid_at', 'subscription_id', 'refund_requested_at', 'refund_reason',
        'refunded_at', 'refund_ref',
    ];

    protected function casts(): array
    {
        return [
            'period' => BillingPeriod::class,
            'status' => InvoiceStatus::class,
            'starts_now' => 'boolean',
            'subtotal' => 'decimal:2',
            'discount' => 'decimal:2',
            'credit' => 'decimal:2',
            'total' => 'decimal:2',
            'snapshot' => 'array',
            'expires_at' => 'datetime',
            'paid_at' => 'datetime',
            'refund_requested_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->orderByDesc('id');
    }

    /** @return BelongsTo<Subscription, $this> */
    public function subscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class);
    }

    public function totalCents(): int
    {
        return Money::toCents((string) $this->total);
    }

    /** Open and still inside its time (an open invoice past expires_at no longer takes receipts). */
    public function isPayable(): bool
    {
        return $this->status->acceptsPayment() && ($this->expires_at === null || $this->expires_at->isFuture());
    }
}
