<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PaymentStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One payment attempt on an invoice: a manual transfer with its receipt, reviewed by the admin.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $invoice_id
 * @property string $method_key
 * @property string $amount decimal string
 * @property string $sender_ref
 * @property string|null $receipt_path
 * @property PaymentStatus $status
 * @property int|null $reviewed_by
 * @property Carbon|null $reviewed_at
 * @property string|null $reject_reason
 * @property Carbon|null $created_at
 */
class Payment extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'invoice_id', 'method_key', 'amount', 'sender_ref', 'receipt_path', 'status', 'reviewed_by', 'reviewed_at', 'reject_reason'];

    protected $hidden = ['receipt_path'];

    protected function casts(): array
    {
        return [
            'status' => PaymentStatus::class,
            'amount' => 'decimal:2',
            'reviewed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Invoice, $this> */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /** @return BelongsTo<PaymentMethod, $this> */
    public function method(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class, 'method_key', 'key');
    }

    public function amountCents(): int
    {
        return Money::toCents((string) $this->amount);
    }
}
