<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\Themes\ThemeCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A theme (platform table). The theme itself is code in the front end; this row is how it is
 * shown and sold in the theme store. Price 0 = free for every store.
 *
 * @property string $key
 * @property string $name
 * @property string $kind landing | store
 * @property string|null $short_description
 * @property string|null $description
 * @property list<string>|null $features
 * @property string $price decimal string
 * @property int $discount_percent
 * @property Carbon|null $discount_starts_at
 * @property Carbon|null $discount_ends_at
 * @property string|null $min_plan_key
 * @property bool $is_featured
 * @property bool $is_listed
 * @property string|null $version
 * @property Carbon|null $released_at
 * @property bool $is_active
 * @property int $sort_order
 */
class Theme extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'key', 'name', 'kind', 'short_description', 'description', 'features', 'price', 'discount_percent',
        'discount_starts_at', 'discount_ends_at', 'min_plan_key', 'is_featured', 'is_listed', 'version',
        'released_at', 'is_active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'features' => 'array',
            'price' => 'decimal:2',
            'discount_percent' => 'integer',
            'discount_starts_at' => 'datetime',
            'discount_ends_at' => 'datetime',
            'is_featured' => 'boolean',
            'is_listed' => 'boolean',
            'released_at' => 'datetime',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => ThemeCatalog::flush());
        static::deleted(fn () => ThemeCatalog::flush());
    }

    /** @param Builder<Theme> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /** @return HasMany<ThemeImage, $this> */
    public function images(): HasMany
    {
        return $this->hasMany(ThemeImage::class, 'theme_key', 'key')->orderBy('position')->orderBy('id');
    }

    /** @return BelongsToMany<ThemeTag, $this> */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(ThemeTag::class, 'theme_tag', 'theme_key', 'theme_tag_id', 'key', 'id')->orderBy('sort_order')->orderBy('name');
    }
}
