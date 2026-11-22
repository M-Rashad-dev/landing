<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ShipmentState;
use App\Models\Concerns\BelongsToTenant;
use App\Support\Money;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * An order sent through a carrier: its tracking number, where it is (our state + the carrier's own code and words),
 * the cash to collect and the timeline. One open shipment per order.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $order_id
 * @property int|null $carrier_account_id
 * @property string $carrier
 * @property string|null $external_id
 * @property string $tracking_number
 * @property ShipmentState $state
 * @property int|null $carrier_code
 * @property string|null $carrier_label
 * @property string $cod
 * @property string|null $exception
 * @property int $attempts
 * @property bool $is_open
 * @property int|null $created_by
 * @property Carbon|null $synced_at
 * @property Carbon|null $created_at
 */
class Shipment extends Model
{
    use BelongsToTenant;

    protected $fillable = ['order_id', 'carrier_account_id', 'carrier', 'external_id', 'tracking_number', 'state', 'carrier_code', 'carrier_label', 'cod', 'exception', 'attempts', 'is_open', 'created_by', 'synced_at'];

    protected function casts(): array
    {
        return [
            'state' => ShipmentState::class,
            'cod' => 'decimal:2',
            'carrier_code' => 'integer',
            'attempts' => 'integer',
            'is_open' => 'boolean',
            'synced_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<CarrierAccount, $this> */
    public function account(): BelongsTo
    {
        return $this->belongsTo(CarrierAccount::class, 'carrier_account_id');
    }

    /** @return HasMany<ShipmentEvent, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(ShipmentEvent::class)->orderBy('happened_at')->orderBy('id');
    }

    public function codCents(): int
    {
        return Money::toCents((string) $this->cod);
    }
}
