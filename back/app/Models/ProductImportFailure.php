<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A product of an import that was not saved: where it is in the file, how to recognise it,
 * why it failed, and its original cells (every row of the product, for the "fix and re-upload" file).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $product_import_id
 * @property int $row_number
 * @property string|null $identifier
 * @property string|null $name
 * @property list<string> $reasons
 * @property list<list<string>> $cells
 */
class ProductImportFailure extends Model
{
    use BelongsToTenant;

    protected $fillable = ['product_import_id', 'row_number', 'identifier', 'name', 'reasons', 'cells'];

    protected function casts(): array
    {
        return ['reasons' => 'array', 'cells' => 'array', 'row_number' => 'integer'];
    }
}
