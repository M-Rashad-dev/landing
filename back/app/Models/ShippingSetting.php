<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Store-wide delivery switch (one row per tenant). Fees live on the shipping companies.
 *
 * @property int $id
 * @property bool $enabled
 */
class ShippingSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['enabled'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean'];
    }
}
