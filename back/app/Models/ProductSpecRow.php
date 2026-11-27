<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * One row of a product's spec table: a label and its value, as typed (plain text: «16GB», «نعم», «غير متاح»).
 *
 * @property int $id
 * @property int $product_spec_table_id
 * @property string $label
 * @property string|null $value
 * @property int $position
 * @property bool $in_card
 * @property bool $filterable
 */
class ProductSpecRow extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = ['product_spec_table_id', 'label', 'value', 'position', 'in_card', 'filterable'];

    protected function casts(): array
    {
        return ['position' => 'integer', 'in_card' => 'boolean', 'filterable' => 'boolean'];
    }
}
