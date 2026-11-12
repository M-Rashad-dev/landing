<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A governorate that differs from the company's default: another fee, or not served.
 * Rows equal to the default are not stored.
 *
 * @property int $id
 * @property int $shipping_company_id
 * @property string $governorate
 * @property string|null $fee
 * @property bool $is_available
 */
class ShippingCompanyRate extends Model
{
    use BelongsToTenant;

    protected $fillable = ['shipping_company_id', 'governorate', 'fee', 'is_available'];

    protected function casts(): array
    {
        return ['fee' => 'decimal:2', 'is_available' => 'boolean'];
    }
}
