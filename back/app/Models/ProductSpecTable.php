<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A spec table of one product: a copy of a group (`spec_group_id`) or the product's own («جدول جديد»).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $product_id
 * @property int|null $spec_group_id
 * @property string $name
 * @property int $position
 */
class ProductSpecTable extends Model
{
    use BelongsToTenant;

    public $timestamps = false;

    protected $fillable = ['product_id', 'spec_group_id', 'name', 'position'];

    protected function casts(): array
    {
        return ['position' => 'integer', 'spec_group_id' => 'integer'];
    }

    /** @return HasMany<ProductSpecRow, $this> */
    public function rows(): HasMany
    {
        return $this->hasMany(ProductSpecRow::class)->orderBy('position')->orderBy('id');
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<SpecGroup, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(SpecGroup::class, 'spec_group_id');
    }
}
