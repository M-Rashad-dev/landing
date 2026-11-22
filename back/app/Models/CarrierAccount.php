<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * A store's connection to a shipping carrier: the merchant's own account (its key, encrypted) today, a platform
 * contract later (`mode` platform). The webhook token + secret let the carrier tell us about its shipments.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $carrier
 * @property string $mode
 * @property array<string, string>|null $credentials
 * @property string $webhook_token
 * @property string $webhook_secret
 * @property array<string, mixed>|null $settings
 * @property string|null $account_name
 * @property string $status
 * @property string|null $last_error
 * @property Carbon|null $checked_at
 */
class CarrierAccount extends Model
{
    use BelongsToTenant;

    public const ACTIVE = 'active';

    public const FAILED = 'failed';

    protected $fillable = ['carrier', 'mode', 'credentials', 'webhook_token', 'webhook_secret', 'settings', 'account_name', 'status', 'last_error', 'checked_at'];

    protected $hidden = ['credentials', 'webhook_secret'];

    protected function casts(): array
    {
        return [
            'credentials' => 'encrypted:array',
            'webhook_secret' => 'encrypted',
            'settings' => 'array',
            'checked_at' => 'datetime',
        ];
    }

    /** @return HasOne<ShippingCompany, $this> */
    public function company(): HasOne
    {
        return $this->hasOne(ShippingCompany::class);
    }

    /** @return HasMany<Shipment, $this> */
    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }

    public function setting(string $key, mixed $default = null): mixed
    {
        return ($this->settings ?? [])[$key] ?? $default;
    }

    public function isActive(): bool
    {
        return $this->status === self::ACTIVE;
    }
}
