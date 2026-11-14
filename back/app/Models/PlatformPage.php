<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A page of the platform itself (about, terms, privacy…), edited by the super admin in Markdown.
 * The set of pages is fixed (each has a route on the platform domain); only their text changes.
 *
 * @property int $id
 * @property string $slug
 * @property string $title
 * @property string|null $summary
 * @property string $body
 * @property bool $is_published
 * @property int $sort_order
 * @property int|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PlatformPage extends Model
{
    /** The pages the platform domain has routes for. */
    public const SLUGS = ['about', 'terms', 'privacy', 'refund-policy', 'acceptable-use'];

    protected $fillable = ['slug', 'title', 'summary', 'body', 'is_published', 'sort_order', 'updated_by'];

    protected function casts(): array
    {
        return ['is_published' => 'boolean', 'sort_order' => 'integer'];
    }

    /** @return BelongsTo<User, $this> */
    public function editor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** @param Builder<PlatformPage> $query */
    public function scopePublished(Builder $query): void
    {
        $query->where('is_published', true);
    }
}
