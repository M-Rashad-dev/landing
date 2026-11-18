<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A section the AI made for a store, on one theme only («أقسامي»). Pages point at it; the Builder
 * shows its current version, live pages the version stamped when they were published.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $kind store|landing
 * @property string $theme_key
 * @property string $name
 * @property int|null $current_version_id
 * @property Carbon|null $archived_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read AiSectionVersion|null $current
 */
class AiSection extends Model
{
    use BelongsToTenant;

    public const KINDS = ['store', 'landing'];

    /** Sections a store keeps per theme («أقسامي»), archived ones not counted. */
    public const MAX_PER_THEME = 60;

    protected $fillable = ['kind', 'theme_key', 'name', 'current_version_id', 'archived_at'];

    protected function casts(): array
    {
        return ['archived_at' => 'datetime'];
    }

    /** @return BelongsTo<AiSectionVersion, $this> */
    public function current(): BelongsTo
    {
        return $this->belongsTo(AiSectionVersion::class, 'current_version_id');
    }

    /** @param Builder<AiSection> $query */
    public function scopeForTheme(Builder $query, string $kind, string $themeKey): void
    {
        $query->where('kind', $kind)->where('theme_key', $themeKey);
    }
}
