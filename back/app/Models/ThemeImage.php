<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\Themes\ThemeCatalog;
use Illuminate\Database\Eloquent\Model;

/**
 * A screenshot of a theme in the store (platform file on the public disk).
 *
 * @property int $id
 * @property string $theme_key
 * @property string $kind cover | desktop | mobile
 * @property array<string, string> $variants
 * @property int $width
 * @property int $height
 * @property int $position
 */
class ThemeImage extends Model
{
    public const KINDS = ['cover', 'desktop', 'mobile'];

    protected $fillable = ['theme_key', 'kind', 'variants', 'width', 'height', 'position'];

    protected function casts(): array
    {
        return ['variants' => 'array', 'width' => 'integer', 'height' => 'integer', 'position' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saved(fn () => ThemeCatalog::flush());
        static::deleted(fn () => ThemeCatalog::flush());
    }

    /** @return array<string, string> */
    public function urls(): array
    {
        return array_map(fn (string $path) => Media::url($path), $this->variants);
    }
}
