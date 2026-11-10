<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\Entitlements;
use App\Enums\AccessState;
use App\Enums\BillingPeriod;
use App\Enums\DomainStatus;
use App\Enums\SubscriptionSource;
use App\Enums\TenantStatus;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Carbon\CarbonInterface;
use Database\Factories\TenantFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * The tenant row itself is not tenant-scoped (it *is* the tenant).
 *
 * @property int $id
 * @property string $name
 * @property TenantStatus $status
 * @property string|null $plan_key copy of the running subscription (SubscriptionManager::sync)
 * @property BillingPeriod|null $plan_period
 * @property SubscriptionSource|null $plan_source
 * @property Carbon|null $plan_ends_at
 * @property Carbon|null $plan_grace_ends_at
 * @property Carbon|null $plan_next_check_at
 * @property string $plan_state open | closed as of the last sync (change detection only)
 * @property bool $trial_used
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
            'plan_period' => BillingPeriod::class,
            'plan_source' => SubscriptionSource::class,
            'plan_ends_at' => 'datetime',
            'plan_grace_ends_at' => 'datetime',
            'plan_next_check_at' => 'datetime',
            'trial_used' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // Cached host lookups carry the tenant status and plan dates (closed sites must stop at once).
        static::saved(function (Tenant $tenant): void {
            PublicSite::forget($tenant->activeHosts(), $tenant->id);
            Entitlements::forget($tenant->id);
        });
    }

    public function isActive(): bool
    {
        return $this->status === TenantStatus::Active;
    }

    /**
     * Access from the plan dates alone, so it is right at any moment without a job:
     * before the period end = active, then grace hours, then expired.
     */
    public function accessState(?CarbonInterface $at = null): AccessState
    {
        $at ??= now();

        if ($this->plan_key === null) {
            return AccessState::Expired;
        }
        if ($this->plan_ends_at !== null && $at->lt($this->plan_ends_at)) {
            return AccessState::Active;
        }
        if ($this->plan_grace_ends_at !== null && $at->lt($this->plan_grace_ends_at)) {
            return AccessState::Grace;
        }

        return AccessState::Expired;
    }

    /** Public sites serve only for an active (not suspended) tenant with a running plan. */
    public function sitesOpen(): bool
    {
        return $this->isActive() && $this->accessState()->isOpen();
    }

    /** @return HasMany<Subscription, $this> */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
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
