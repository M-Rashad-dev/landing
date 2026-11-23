<?php

declare(strict_types=1);

namespace App\Models;

use App\Auth\PermissionCatalog;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Carbon;

/**
 * «سجل النشاط»: who changed what in the store (every successful dashboard change, and sign-ins). Kept 180 days.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string|null $permission
 * @property string $method
 * @property string $path
 * @property int|null $subject_id
 * @property string $summary
 * @property string|null $ip
 * @property Carbon $created_at
 */
class ActivityLog extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    public const KEEP_DAYS = 180;

    protected $fillable = ['user_id', 'permission', 'method', 'path', 'subject_id', 'summary', 'ip'];

    protected function casts(): array
    {
        return ['subject_id' => 'integer', 'created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function record(User $user, ?string $permission, Request $request, ?Route $route, ?string $summary = null): void
    {
        $subject = null;
        foreach ($route?->parameters() ?? [] as $value) {
            $id = $value instanceof Model ? $value->getKey() : $value;
            if (is_numeric($id)) {
                $subject = (int) $id;
                break;
            }
        }
        $summary ??= $permission !== null ? PermissionCatalog::label($permission) : $request->method().' '.$request->path();

        self::query()->create([
            'user_id' => $user->id,
            'permission' => $permission !== null ? mb_substr($permission, 0, 60) : null,
            'method' => $request->method(),
            'path' => mb_substr($request->path(), 0, 255),
            'subject_id' => $subject,
            'summary' => mb_substr($summary.($subject !== null ? ' #'.$subject : ''), 0, 255),
            'ip' => $request->ip(),
        ]);
    }
}
