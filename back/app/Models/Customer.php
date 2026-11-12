<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A store's customer, one per phone (E.164). Made from orders; the storefront accounts
 * (phone + one-time code) are the same row.
 *
 * @property int $id
 * @property string $phone
 * @property string|null $name
 * @property string|null $governorate
 * @property string|null $city
 * @property string|null $address
 * @property string|null $note
 * @property bool $block_exempt the merchant lifted an automatic block: never blocked automatically again
 * @property Carbon|null $signed_up_at first sign-in on the storefront (null: never signed in)
 * @property Carbon|null $first_order_at
 * @property Carbon|null $last_order_at
 */
class Customer extends Model
{
    use BelongsToTenant;

    protected $fillable = ['phone', 'name', 'governorate', 'city', 'address', 'note', 'block_exempt', 'first_order_at', 'last_order_at'];

    protected function casts(): array
    {
        return ['first_order_at' => 'datetime', 'last_order_at' => 'datetime', 'signed_up_at' => 'datetime', 'block_exempt' => 'boolean'];
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** @return HasMany<CustomerAddress, $this> */
    public function addresses(): HasMany
    {
        return $this->hasMany(CustomerAddress::class);
    }

    /** @return HasMany<ProductReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }
}
