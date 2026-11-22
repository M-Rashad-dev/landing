<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A file a digital product delivers (private disk, `product-files/{tenant}/{product}`), with the name the customer
 * sees. Counted in the plan's storage.
 *
 * @property int $id
 * @property int $product_id
 * @property string $name
 * @property string $path
 * @property string $original_name
 * @property string $mime
 * @property int $size bytes
 * @property int $position
 */
class ProductFile extends Model
{
    use BelongsToTenant;

    /** Files on one product. */
    public const MAX = 10;

    public const MAX_KB = 102400;

    protected $fillable = ['product_id', 'name', 'path', 'original_name', 'mime', 'size', 'position'];

    protected $hidden = ['path'];

    protected function casts(): array
    {
        return ['size' => 'integer', 'position' => 'integer'];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
