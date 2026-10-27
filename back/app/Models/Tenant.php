<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DomainStatus;
use App\Enums\TenantStatus;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Database\Factories\TenantFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * The tenant row itself is not tenant-scoped (it *is* the tenant).
 *
 * @property int $id
 * @property string $name
 * @property TenantStatus $status
 */
class Tenant extends Model
{
    /** @use HasFactory<TenantFactory> */
    use HasFactory;

    protected $fillable = ['name', 'status', 'suspended_at', 'suspended_reason', 'settings'];

    protected function casts(): array
    {
        return [
            'status' => TenantStatus::class,
            'suspended_at' => 'datetime',
            'settings' => 'array',
        ];
    }

    protected static function booted(): void
    {
        // Cached host lookups carry the tenant status (suspended sites must stop at once).
        static::saved(fn (Tenant $tenant) => PublicSite::forget($tenant->activeHosts(), $tenant->id));
    }

    public function isActive(): bool
    {
        return $this->status === TenantStatus::Active;
    }

    /** @return HasMany<User, $this> */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Domains are tenant-scoped; access them from here only inside a matching
     * tenant context or Tenancy::withoutTenant().
     *
     * @return HasMany<Domain, $this>
     */
    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class);
    }

    /**
     * Tenant-scoped like domains(); counted by the super admin inside Tenancy::withoutTenant().
     *
     * @return HasMany<LandingPage, $this>
     */
    public function pages(): HasMany
    {
        return $this->hasMany(LandingPage::class);
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** @return HasOne<Domain, $this> */
    public function primaryDomain(): HasOne
    {
        return $this->hasOne(Domain::class)->where('is_primary', true);
    }

    /**
     * Hosts currently serving this tenant's public pages.
     *
     * @return list<string>
     */
    public function activeHosts(): array
    {
        // Audited bypass: explicitly filtered to this tenant's id.
        return Tenancy::withoutTenant(fn () => Domain::query()
            ->where('tenant_id', $this->id)
            ->where('status', DomainStatus::Active)
            ->pluck('host')
            ->all());
    }
}
