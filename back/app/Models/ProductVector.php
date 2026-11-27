<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A store product's vector (name + description) for the AI quiz's first pick out of a big catalog.
 *
 * @property int $product_id
 * @property string $hash
 * @property string $model
 * @property list<float> $vector
 */
class ProductVector extends Model
{
    use BelongsToTenant;

    protected $fillable = ['product_id', 'hash', 'model', 'vector'];

    protected function casts(): array
    {
        return ['vector' => 'array', 'product_id' => 'integer'];
    }
}
