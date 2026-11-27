<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * One label of a spec group, with its two flags copied into products: shown on product cards (`in_card`) and a
 * filter on category pages (`filterable`).
 *
 * @property int $id
 * @property int $spec_group_id
 * @property string $label
 * @property int $position
 * @property bool $in_card
 * @property bool $filterable
 */
class SpecGroupRow extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = ['spec_group_id', 'label', 'position', 'in_card', 'filterable'];

    protected function casts(): array
    {
        return ['position' => 'integer', 'in_card' => 'boolean', 'filterable' => 'boolean'];
    }
}
