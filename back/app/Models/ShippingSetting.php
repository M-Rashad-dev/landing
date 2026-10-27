<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * Store-wide delivery settings (one row per tenant).
 *
 * @property int $id
 * @property bool $enabled
 * @property string $default_fee
 * @property string|null $free_over
 */
class ShippingSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['enabled', 'default_fee', 'free_over'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'default_fee' => 'decimal:2', 'free_over' => 'decimal:2'];
    }
}
