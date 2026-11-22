<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ShipmentState;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One step of a shipment's timeline, as the carrier told it.
 *
 * @property int $id
 * @property int $shipment_id
 * @property ShipmentState $state
 * @property int|null $carrier_code
 * @property string|null $label
 * @property string|null $note
 * @property Carbon $happened_at
 */
class ShipmentEvent extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $fillable = ['shipment_id', 'state', 'carrier_code', 'label', 'note', 'happened_at'];

    protected function casts(): array
    {
        return [
            'state' => ShipmentState::class,
            'carrier_code' => 'integer',
            'happened_at' => 'datetime',
        ];
    }
}
