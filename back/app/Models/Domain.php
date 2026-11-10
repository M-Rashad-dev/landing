<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\SslStatus;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use App\Services\PublicSite;
use Database\Factories\DomainFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property int $tenant_id
 * @property string $host
 * @property DomainType $type
 * @property DomainStatus $status
 * @property bool $is_primary
 * @property string|null $active_host
 */
class Domain extends Model
{
    /** @use HasFactory<DomainFactory> */
    use BelongsToTenant, HasFactory, LockableByPlan;

    protected $fillable = [
        'tenant_id', 'host', 'type', 'status', 'is_primary', 'active_host', 'verified_at',
        'check_attempts', 'last_checked_at', 'last_check_error', 'ssl_status', 'ssl_checked_at',
    ];

    protected function casts(): array
    {
        return [
            'type' => DomainType::class,
            'status' => DomainStatus::class,
            'ssl_status' => SslStatus::class,
            'is_primary' => 'boolean',
            'verified_at' => 'datetime',
            'last_checked_at' => 'datetime',
            'ssl_checked_at' => 'datetime',
            'check_attempts' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // Public host lookups are cached (PublicSite); any change to a domain clears its old and new host.
        $forget = fn (Domain $domain) => PublicSite::forget(
            [$domain->host, $domain->getOriginal('host'), $domain->active_host, $domain->getOriginal('active_host')],
            $domain->tenant_id,
        );
        static::saved($forget);
        static::deleted($forget);
    }

    public function setHostAttribute(string $value): void
    {
        $this->attributes['host'] = mb_strtolower(trim($value));
    }

    public function isActive(): bool
    {
        return $this->status === DomainStatus::Active;
    }
}
