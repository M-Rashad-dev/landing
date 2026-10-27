<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Who did what to whom from the super admin panel. Platform-level (not tenant-scoped).
 *
 * @property int $id
 * @property int|null $admin_user_id
 * @property string $action
 * @property string $target_type
 * @property string $target_id
 * @property array<string, mixed>|null $meta
 * @property string|null $ip
 */
class AdminAuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['admin_user_id', 'action', 'target_type', 'target_id', 'meta', 'ip'];

    protected function casts(): array
    {
        return ['meta' => 'array', 'created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
