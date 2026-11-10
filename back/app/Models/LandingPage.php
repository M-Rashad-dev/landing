<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\PageStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use Database\Factories\LandingPageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $title
 * @property string $slug
 * @property PageStatus $status
 * @property string $theme_key
 * @property int $identity_id
 * @property int|null $product_id
 * @property array{version: int, sections: list<array<string, mixed>>} $draft_content
 * @property array{version: int, sections: list<array<string, mixed>>}|null $published_content
 * @property int $version
 * @property Carbon|null $published_at
 * @property bool $is_home
 * @property int|null $home_key
 * @property array<string, mixed>|null $seo_override
 * @property array<string, mixed>|null $tracking_override
 */
class LandingPage extends Model
{
    /** @use HasFactory<LandingPageFactory> */
    use BelongsToTenant, HasFactory, LockableByPlan, SoftDeletes;

    protected $attributes = ['kind' => self::KIND_LANDING];

    protected $fillable = [
        'kind', 'title', 'slug', 'status', 'theme_key', 'identity_id', 'product_id', 'draft_content', 'published_content',
        'version', 'published_at', 'is_home', 'home_key', 'seo_override', 'tracking_override', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => PageStatus::class,
            'draft_content' => 'array',
            'published_content' => 'array',
            'version' => 'integer',
            'published_at' => 'datetime',
            'is_home' => 'boolean',
            'home_key' => 'integer',
            'seo_override' => 'array',
            'tracking_override' => 'array',
        ];
    }

    public const KIND_LANDING = 'landing';

    /** The store home: built in the Builder with store sections, served at "/" of the store. */
    public const KIND_STORE_HOME = 'store_home';

    public function isStoreHome(): bool
    {
        return $this->kind === self::KIND_STORE_HOME;
    }

    /** @param Builder<LandingPage> $query */
    public function scopeLandings(Builder $query): void
    {
        $query->where($this->qualifyColumn('kind'), self::KIND_LANDING);
    }

    /** @return BelongsTo<Identity, $this> */
    public function identity(): BelongsTo
    {
        return $this->belongsTo(Identity::class)->withTrashed();
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /** @return BelongsTo<Theme, $this> */
    public function theme(): BelongsTo
    {
        return $this->belongsTo(Theme::class, 'theme_key', 'key');
    }

    public function isPublished(): bool
    {
        return $this->status === PageStatus::Published;
    }

    public function hasUnpublishedChanges(): bool
    {
        return $this->isPublished() && $this->published_content != $this->draft_content;
    }
}
