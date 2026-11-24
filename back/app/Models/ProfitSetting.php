<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * The store's fixed cost per order (packaging), snapshotted on each new order. One row, made on first save.
 *
 * @property string $packaging_cost
 */
class ProfitSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['packaging_cost'];

    protected $attributes = ['packaging_cost' => '0.00'];

    protected function casts(): array
    {
        return ['packaging_cost' => 'decimal:2'];
    }

    public static function current(): self
    {
        return self::query()->first() ?? new self;
    }
}
