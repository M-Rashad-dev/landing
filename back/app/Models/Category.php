<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A store category; a tree through parent_id (depth capped in config, cycles refused).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int|null $parent_id
 * @property int $depth
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property int|null $media_id
 * @property int $position
 * @property bool $is_visible
 * @property array<string, mixed>|null $seo
 */
class Category extends Model
{
    use BelongsToTenant, LockableByPlan;

    protected $fillable = ['parent_id', 'depth', 'name', 'slug', 'description', 'media_id', 'position', 'is_visible', 'seo'];

    protected function casts(): array
    {
        return ['depth' => 'integer', 'position' => 'integer', 'is_visible' => 'boolean', 'seo' => 'array'];
    }

    /** @return BelongsTo<Category, $this> */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** @return HasMany<Category, $this> */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('position')->orderBy('id');
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class);
    }

    /** @return BelongsTo<Media, $this> */
    public function image(): BelongsTo
    {
        return $this->belongsTo(Media::class, 'media_id');
    }
}
