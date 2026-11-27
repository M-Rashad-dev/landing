<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * «مجموعة مواصفات»: a named table of labels («لابتوب»: المعالج، الرامات…) the merchant adds to products. Its rows
 * are copied into each product (the product's table keeps `spec_group_id` to receive later additions).
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $name
 * @property int $position
 */
class SpecGroup extends Model
{
    use BelongsToTenant;

    protected $fillable = ['name', 'position'];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    /** @return HasMany<SpecGroupRow, $this> */
    public function rows(): HasMany
    {
        return $this->hasMany(SpecGroupRow::class)->orderBy('position')->orderBy('id');
    }

    /** The products' copies of this group. @return HasMany<ProductSpecTable, $this> */
    public function tables(): HasMany
    {
        return $this->hasMany(ProductSpecTable::class);
    }
}
