<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\PlanCatalog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A plan (platform table). The key is fixed once created; everything else is edited by the admin.
 *
 * @property string $key
 * @property string $name
 * @property string|null $tagline
 * @property string|null $description
 * @property list<string>|null $marketing_points
 * @property bool $is_public
 * @property bool $is_highlighted
 * @property bool $is_archived
 * @property int $sort_order
 */
class Plan extends Model
{
    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['key', 'name', 'tagline', 'description', 'marketing_points', 'is_public', 'is_highlighted', 'is_archived', 'sort_order'];

    protected function casts(): array
    {
        return [
            'marketing_points' => 'array',
            'is_public' => 'boolean',
            'is_highlighted' => 'boolean',
            'is_archived' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => PlanCatalog::flush());
        static::deleted(fn () => PlanCatalog::flush());
    }

    /** @return HasMany<PlanPrice, $this> */
    public function prices(): HasMany
    {
        return $this->hasMany(PlanPrice::class, 'plan_key', 'key');
    }

    /** @return HasMany<PlanFeatureValue, $this> */
    public function values(): HasMany
    {
        return $this->hasMany(PlanFeatureValue::class, 'plan_key', 'key');
    }
}
