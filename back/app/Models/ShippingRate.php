<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Delivery fee / availability for one governorate (null fee → the default fee).
 *
 * @property int $id
 * @property string $governorate
 * @property string|null $fee
 * @property bool $is_available
 */
class ShippingRate extends Model
{
    use BelongsToTenant;

    protected $fillable = ['governorate', 'fee', 'is_available'];

    protected function casts(): array
    {
        return ['fee' => 'decimal:2', 'is_available' => 'boolean'];
    }
}
