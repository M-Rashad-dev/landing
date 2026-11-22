<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * One entry of a codes product (a code, or an email + password…), encrypted; sent to buyers in order of position,
 * each one up to uses_total times. combination_key = the option values it belongs to ("" without options).
 *
 * @property int $id
 * @property int $product_id
 * @property string $combination_key
 * @property string $code
 * @property int $uses_total
 * @property int $uses_left
 * @property int $position
 */
class ProductCode extends Model
{
    use BelongsToTenant;

    /** Entries on one product (all options together). */
    public const MAX = 5000;

    protected $fillable = ['product_id', 'combination_key', 'code', 'uses_total', 'uses_left', 'position'];

    protected $hidden = ['code'];

    protected function casts(): array
    {
        return ['code' => 'encrypted', 'uses_total' => 'integer', 'uses_left' => 'integer', 'position' => 'integer'];
    }
}
