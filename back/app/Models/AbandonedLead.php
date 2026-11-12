<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\LeadStatus;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $landing_page_id
 * @property int|null $product_id
 * @property string|null $customer_name
 * @property string|null $customer_phone
 * @property string $source landing (page form) · store (checkout) · cart
 * @property string|null $cart_token
 * @property string|null $governorate
 * @property int $quantity
 * @property LeadStatus $status
 * @property int|null $order_id
 * @property Carbon|null $contacted_at
 * @property Carbon|null $last_seen_at
 * @property Carbon $created_at
 */
class AbandonedLead extends Model
{
    use BelongsToTenant;

    protected $fillable = ['source', 'cart', 'cart_token', 'landing_page_id', 'product_id', 'customer_name', 'customer_phone', 'governorate', 'quantity', 'status', 'order_id', 'contacted_at', 'last_seen_at', 'ip_address'];

    protected function casts(): array
    {
        return [
            'cart' => 'array', 'status' => LeadStatus::class, 'quantity' => 'integer', 'contacted_at' => 'datetime', 'last_seen_at' => 'datetime'];
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

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
