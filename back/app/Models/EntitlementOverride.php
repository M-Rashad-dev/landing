<?php

declare(strict_types=1);

namespace App\Models;

use App\Billing\Entitlements;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Admin exception for one tenant: this feature / limit value wins over the plan's.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $entitlement
 * @property int|null $value
 * @property string $reason
 * @property Carbon|null $expires_at
 * @property int|null $created_by
 */
class EntitlementOverride extends Model
{
    use BelongsToTenant;

    protected $fillable = ['tenant_id', 'entitlement', 'value', 'reason', 'expires_at', 'created_by'];

    protected function casts(): array
    {
        return ['value' => 'integer', 'expires_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::saved(fn (EntitlementOverride $o) => Entitlements::forget($o->tenant_id));
        static::deleted(fn (EntitlementOverride $o) => Entitlements::forget($o->tenant_id));
    }
}
