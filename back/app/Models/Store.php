<?php

declare(strict_types=1);

namespace App\Models;

use App\Jobs\RevalidateTenantHosts;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The tenant's online store (one per tenant). When enabled (and the plan has "store"), its
 * published design owns "/" of every store host and landing pages stay on /{slug}.
 *
 * @property int $id
 * @property int $tenant_id
 * @property bool $is_enabled
 * @property string $theme_key the active theme (its design is in store_designs)
 * @property array{header?: list<array<string, mixed>>, footer?: list<array<string, mixed>>}|null $menus
 * @property array<string, mixed>|null $seo
 */
class Store extends Model
{
    use BelongsToTenant;

    protected $fillable = ['is_enabled', 'theme_key', 'menus', 'seo'];

    protected function casts(): array
    {
        return ['is_enabled' => 'boolean', 'menus' => 'array', 'seo' => 'array'];
    }

    protected static function booted(): void
    {
        // Public pages read the store config (cached by Next): purge them on every change.
        static::saved(fn (Store $store) => RevalidateTenantHosts::dispatch($store->tenant_id)->afterCommit());
    }

    /** The design of the active theme (null until the store is prepared). */
    public function design(): ?StoreDesign
    {
        return StoreDesign::query()->where('theme_key', $this->theme_key)->first();
    }

    /** @return BelongsTo<Theme, $this> */
    public function theme(): BelongsTo
    {
        return $this->belongsTo(Theme::class, 'theme_key', 'key');
    }
}
