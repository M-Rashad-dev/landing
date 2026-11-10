<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\Themes\ThemeCatalog;
use Illuminate\Database\Eloquent\Model;

/**
 * A theme store hashtag (ملابس، إكسسوارات…), managed by the admin.
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property int $sort_order
 */
class ThemeTag extends Model
{
    protected $fillable = ['slug', 'name', 'sort_order'];

    protected function casts(): array
    {
        return ['sort_order' => 'integer'];
    }

    protected static function booted(): void
    {
        static::saved(fn () => ThemeCatalog::flush());
        static::deleted(fn () => ThemeCatalog::flush());
    }
}
