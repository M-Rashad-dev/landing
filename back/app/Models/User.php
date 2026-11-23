<?php

declare(strict_types=1);

namespace App\Models;

use App\Auth\PermissionCatalog;
use App\Enums\NotifyChannel;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * Users are not tenant-scoped: login must find them before a tenant is known.
 * tenant_id = null means super admin.
 *
 * @property int $id
 * @property int|null $tenant_id
 * @property UserRole $role
 * @property bool $is_active
 * @property NotifyChannel $notify_channel where notifications go besides the bell
 * @property int|null $invited_by staff: who added him
 * @property Carbon|null $invited_at
 * @property Carbon|null $accepted_at staff: set his password from the invitation
 * @property bool $locked_by_plan staff over the plan's seats (can't sign in)
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles;

    /** Permissions are checked on this guard whatever guard signed the user in (Sanctum tokens). */
    protected string $guard_name = 'web';

    protected $fillable = ['tenant_id', 'name', 'email', 'phone', 'notify_channel', 'password', 'role', 'is_active', 'last_login_at'];

    protected $hidden = ['password'];

    /** @var array<string, mixed> */
    protected $attributes = ['notify_channel' => 'whatsapp'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
            'notify_channel' => NotifyChannel::class,
            'last_login_at' => 'datetime',
            'invited_at' => 'datetime',
            'accepted_at' => 'datetime',
            'locked_by_plan' => 'boolean',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isStaff(): bool
    {
        return $this->role === UserRole::Staff;
    }

    /** The store's owner or a staff member with this permission (App\Auth\PermissionCatalog key). */
    public function allows(string $permission): bool
    {
        return PermissionCatalog::allows($this, $permission);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin && $this->tenant_id === null;
    }

    public function setEmailAttribute(string $value): void
    {
        $this->attributes['email'] = mb_strtolower(trim($value));
    }
}
