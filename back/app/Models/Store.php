<?php

declare(strict_types=1);

namespace App\Models;

use App\Jobs\RevalidateTenantHosts;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The tenant's online store (one per tenant). When enabled (and the plan has "store"), its
 * home owns "/" of every store host and landing pages stay on /{slug}.
 *
 * @property int $id
 * @property int $tenant_id
 * @property bool $is_enabled
 * @property string $theme_key
 * @property int|null $home_page_id
 * @property array{header?: list<array<string, mixed>>, footer?: list<array<string, mixed>>}|null $menus
 * @property array<string, mixed>|null $settings
 * @property array<string, mixed>|null $seo
 */
class Store extends Model
{
    use BelongsToTenant;

    public const DEFAULT_SETTINGS = [
        'announcement' => null,
        'products_per_page' => 24,
        'show_whatsapp' => true,
        'show_out_of_stock' => true,
    ];

    protected $fillable = ['is_enabled', 'theme_key', 'home_page_id', 'menus', 'settings', 'seo'];

    protected function casts(): array
    {
        return ['is_enabled' => 'boolean', 'menus' => 'array', 'settings' => 'array', 'seo' => 'array'];
    }

    protected static function booted(): void
    {
        // Public pages read the store config (cached by Next): purge them on every change.
        static::saved(fn (Store $store) => RevalidateTenantHosts::dispatch($store->tenant_id)->afterCommit());
    }

    /** @return array<string, mixed> */
    public function resolvedSettings(): array
    {
        return array_merge(self::DEFAULT_SETTINGS, array_intersect_key($this->settings ?? [], self::DEFAULT_SETTINGS));
    }

    /** @return BelongsTo<LandingPage, $this> */
    public function homePage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'home_page_id');
    }

    /** @return BelongsTo<Theme, $this> */
    public function theme(): BelongsTo
    {
        return $this->belongsTo(Theme::class, 'theme_key', 'key');
    }
}
