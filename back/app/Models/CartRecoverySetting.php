<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * The store's abandoned cart reminders (one row, made on first save).
 *
 * @property bool $enabled
 * @property bool $whatsapp
 * @property bool $email
 * @property int $first_minutes
 * @property int|null $second_hours null = one reminder only
 * @property string $coupon_mode none | code (an existing code) | generated (one per lead)
 * @property int|null $discount_code_id
 * @property string $coupon_type percentage | fixed
 * @property string|null $coupon_value
 */
class CartRecoverySetting extends Model
{
    use BelongsToTenant;

    public const COUPON_NONE = 'none';

    public const COUPON_CODE = 'code';

    public const COUPON_GENERATED = 'generated';

    protected $fillable = ['enabled', 'whatsapp', 'email', 'first_minutes', 'second_hours', 'coupon_mode', 'discount_code_id', 'coupon_type', 'coupon_value'];

    protected $attributes = ['enabled' => false, 'whatsapp' => true, 'email' => true, 'first_minutes' => 60, 'second_hours' => 24, 'coupon_mode' => self::COUPON_NONE, 'coupon_type' => 'percentage'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'whatsapp' => 'boolean', 'email' => 'boolean', 'first_minutes' => 'integer', 'second_hours' => 'integer', 'coupon_value' => 'decimal:2'];
    }

    public static function current(): self
    {
        return self::query()->first() ?? new self;
    }
}
