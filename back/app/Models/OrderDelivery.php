<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DeliveryType;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * What one digital order line delivered (one row per line, made once): the codes sent, the downloads / opens used,
 * or the service message. The token is the customer's private key for downloads and the link.
 *
 * @property int $id
 * @property int $order_id
 * @property int $order_item_id
 * @property int|null $product_id
 * @property DeliveryType $type
 * @property string $status pending | delivered | revoked (refunded: downloads / the link stopped)
 * @property string $token
 * @property array{codes?: list<string>, link?: string, subject?: string, message?: string}|null $payload
 * @property array<string, int>|null $usage file id (or "link") => times used
 * @property int|null $limit per file / link, null = unlimited
 * @property int $bonus extra the merchant granted
 * @property Carbon|null $delivered_at
 * @property Carbon|null $emailed_at
 */
class OrderDelivery extends Model
{
    use BelongsToTenant;

    public const PENDING = 'pending';

    public const DELIVERED = 'delivered';

    /** Refunded with «وقف التحميل»: no more downloads, opens or codes. */
    public const REVOKED = 'revoked';

    protected $fillable = ['order_id', 'order_item_id', 'product_id', 'type', 'status', 'token', 'payload', 'usage', 'limit', 'bonus', 'delivered_at', 'emailed_at'];

    protected $hidden = ['payload'];

    protected function casts(): array
    {
        return [
            'type' => DeliveryType::class,
            'payload' => 'encrypted:array',
            'usage' => 'array',
            'limit' => 'integer',
            'bonus' => 'integer',
            'delivered_at' => 'datetime',
            'emailed_at' => 'datetime',
        ];
    }

    /** Times this file (or the link) can still be used; null = unlimited. */
    public function left(string $key): ?int
    {
        if ($this->status === self::REVOKED) {
            return 0;
        }

        return $this->limit === null ? null : max(0, $this->limit + $this->bonus - (int) (($this->usage ?? [])[$key] ?? 0));
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<OrderItem, $this> */
    public function item(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}
