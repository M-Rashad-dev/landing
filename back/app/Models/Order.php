<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ConfirmState;
use App\Enums\OrderPaymentState;
use App\Enums\OrderRefundState;
use App\Enums\OrderStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Amounts are a snapshot of the quote at creation time and never change afterwards.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $order_number
 * @property int|null $landing_page_id
 * @property int|null $product_id
 * @property OrderStatus $status
 * @property Carbon|null $status_changed_at
 * @property string $customer_name
 * @property string $customer_phone
 * @property string|null $customer_phone2
 * @property string|null $customer_email
 * @property bool $whatsapp_opt_in the customer agreed to order messages on WhatsApp
 * @property string|null $track_token
 * @property string|null $governorate
 * @property string|null $city
 * @property string|null $address
 * @property string|null $notes
 * @property string|null $internal_note
 * @property list<array{key: string, label: string, type: string, value: mixed}>|null $answers
 * @property int $quantity
 * @property string $unit_price
 * @property string $subtotal
 * @property int|null $offer_id
 * @property string|null $offer_name
 * @property string $offer_discount
 * @property int|null $discount_code_id
 * @property string|null $discount_code
 * @property string $code_discount
 * @property string $shipping_fee
 * @property int|null $shipping_company_id
 * @property string|null $shipping_company_name
 * @property string|null $shipping_offer_name
 * @property string $shipping_discount
 * @property string|null $tracking_number
 * @property int|null $customer_id
 * @property string $total
 * @property string $currency
 * @property bool $is_duplicate_suspect
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property array<string, string>|null $utm
 * @property string $payment_method cod | prepaid
 * @property int|null $store_payment_method_id
 * @property string|null $payment_method_name
 * @property OrderPaymentState|null $payment_status null for cash on delivery
 * @property Carbon|null $paid_at
 * @property string $refunded_total sum of the done refunds (App\Orders\Refunds)
 * @property OrderRefundState|null $refund_state
 * @property ConfirmState|null $confirm_state the WhatsApp confirmation (null = none sent)
 * @property Carbon|null $confirm_sent_at
 * @property Carbon|null $confirm_replied_at
 * @property Carbon $created_at
 */
class Order extends Model
{
    public const COD = 'cod';

    public const PREPAID = 'prepaid';

    /** @use HasFactory<OrderFactory> */
    use BelongsToTenant, HasFactory;

    // tenant_id is set by BelongsToTenant, never mass-assigned.
    protected $fillable = [
        'order_number', 'landing_page_id', 'source', 'ab_test_id', 'product_id', 'status', 'status_changed_at',
        'customer_name', 'customer_phone', 'customer_phone2', 'customer_email', 'whatsapp_opt_in', 'governorate', 'city', 'address', 'notes', 'internal_note', 'answers',
        'quantity', 'unit_price', 'subtotal', 'offer_id', 'offer_name', 'offer_discount',
        'discount_code_id', 'discount_code', 'code_discount', 'shipping_fee', 'shipping_company_id', 'shipping_company_name', 'shipping_offer_name', 'shipping_discount', 'tracking_number', 'customer_id', 'total', 'currency',
        'is_duplicate_suspect', 'ip_address', 'user_agent', 'utm',
        'payment_method', 'store_payment_method_id', 'payment_method_name', 'payment_status', 'paid_at',
    ];

    // contact_attempts / last_contacted_at / follow_up_at are written by RecordOrderContact only (forceFill).

    protected function casts(): array
    {
        return [
            'contact_attempts' => 'integer',
            'last_contacted_at' => 'datetime',
            'follow_up_at' => 'datetime',
            'order_number' => 'integer',
            'status' => OrderStatus::class,
            'status_changed_at' => 'datetime',
            'answers' => 'array',
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'offer_discount' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'shipping_discount' => 'decimal:2',
            'shipping_cost' => 'decimal:2',
            'return_cost' => 'decimal:2',
            'cod_fee' => 'decimal:2',
            'packaging_cost' => 'decimal:2',
            'code_discount' => 'decimal:2',
            'total' => 'decimal:2',
            'is_duplicate_suspect' => 'boolean',
            'whatsapp_opt_in' => 'boolean',
            'utm' => 'array',
            'payment_status' => OrderPaymentState::class,
            'confirm_state' => ConfirmState::class,
            'confirm_sent_at' => 'datetime',
            'confirm_reminded_at' => 'datetime',
            'confirm_replied_at' => 'datetime',
            'paid_at' => 'datetime',
            'refunded_total' => 'decimal:2',
            'refund_state' => OrderRefundState::class,
        ];
    }

    /** Prepaid (paid before delivery through one of the store's own methods), not cash on delivery. */
    public function isPrepaid(): bool
    {
        return $this->payment_method === self::PREPAID;
    }

    /** Every order gets a private tracking token (the customer's link /t/{token}, never guessable). */
    protected static function booted(): void
    {
        static::creating(function (Order $order): void {
            $order->track_token ??= strtolower(Str::random(12));
        });
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** @return HasMany<Shipment, $this> */
    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class)->orderBy('id');
    }

    /** @return HasOne<Shipment, $this> the open one (or the latest) */
    public function shipment(): HasOne
    {
        return $this->hasOne(Shipment::class)->latestOfMany();
    }

    /** Receipts the customer sent (prepaid orders), newest last. @return HasMany<OrderPayment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(OrderPayment::class)->orderBy('id');
    }

    /** Money sent back to the customer (stage 5 of merchant-essentials), oldest first. @return HasMany<OrderRefund, $this> */
    public function refunds(): HasMany
    {
        return $this->hasMany(OrderRefund::class)->orderBy('id');
    }

    /** @return HasMany<OrderStatusLog, $this> */
    public function logs(): HasMany
    {
        return $this->hasMany(OrderStatusLog::class)->orderBy('id');
    }

    /** @return HasMany<OrderEvent, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(OrderEvent::class)->orderBy('id');
    }

    /** @return BelongsTo<LandingPage, $this> */
    public function page(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id')->withTrashed();
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /** @return HasOne<DiscountCodeRedemption, $this> */
    public function redemption(): HasOne
    {
        return $this->hasOne(DiscountCodeRedemption::class);
    }

    public function totalCents(): int
    {
        return Money::toCents($this->total);
    }
}
