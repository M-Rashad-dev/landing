<?php

declare(strict_types=1);

namespace App\Models;

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
 * @property string $total
 * @property string $currency
 * @property bool $is_duplicate_suspect
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property array<string, string>|null $utm
 * @property Carbon $created_at
 */
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use BelongsToTenant, HasFactory;

    protected $guarded = ['id', 'tenant_id'];

    protected function casts(): array
    {
        return [
            'order_number' => 'integer',
            'status' => OrderStatus::class,
            'status_changed_at' => 'datetime',
            'answers' => 'array',
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'offer_discount' => 'decimal:2',
            'code_discount' => 'decimal:2',
            'total' => 'decimal:2',
            'is_duplicate_suspect' => 'boolean',
            'utm' => 'array',
        ];
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** @return HasMany<OrderStatusLog, $this> */
    public function logs(): HasMany
    {
        return $this->hasMany(OrderStatusLog::class)->orderBy('id');
    }

    /** @return BelongsTo<LandingPage, $this> */
    public function page(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id')->withTrashed();
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
