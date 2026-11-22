<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * The store's payment choices (one row, made on first save): cash on delivery on or off, and after how many days
 * an unpaid prepaid order is cancelled.
 *
 * @property bool $cod_enabled
 * @property int $cancel_after_days
 */
class StorePaymentSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['cod_enabled', 'cancel_after_days'];

    protected $attributes = ['cod_enabled' => true, 'cancel_after_days' => 3];

    protected function casts(): array
    {
        return ['cod_enabled' => 'boolean', 'cancel_after_days' => 'integer'];
    }

    public static function current(): self
    {
        return self::query()->first() ?? new self;
    }
}
