<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * The store's WhatsApp order confirmation (one row, made on first save).
 *
 * @property bool $enabled
 * @property int $delay_minutes
 * @property int|null $reminder_hours
 * @property int $final_hours
 * @property string $on_timeout keep | cancel
 */
class OrderConfirmationSetting extends Model
{
    use BelongsToTenant;

    protected $fillable = ['enabled', 'delay_minutes', 'reminder_hours', 'final_hours', 'on_timeout'];

    protected $attributes = ['enabled' => false, 'delay_minutes' => 0, 'reminder_hours' => 6, 'final_hours' => 24, 'on_timeout' => 'keep'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'delay_minutes' => 'integer', 'reminder_hours' => 'integer', 'final_hours' => 'integer'];
    }

    public static function current(): self
    {
        return self::query()->first() ?? new self;
    }
}
