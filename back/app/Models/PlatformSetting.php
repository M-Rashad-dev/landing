<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\PlatformSettings;
use Illuminate\Database\Eloquent\Model;

/**
 * Platform-wide key/value settings edited by the super admin. Read through PlatformSettings.
 *
 * @property string $key
 * @property mixed $value
 */
class PlatformSetting extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'json'];
    }

    protected static function booted(): void
    {
        static::saved(fn () => PlatformSettings::flush());
        static::deleted(fn () => PlatformSettings::flush());
    }
}
