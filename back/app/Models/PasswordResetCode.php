<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A "forgot my password" code sent to a dashboard user (see PasswordReset). Not tenant data.
 *
 * @property int $id
 * @property int $user_id
 * @property string $code_hash
 * @property int $attempts
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 * @property string|null $ip
 */
class PasswordResetCode extends Model
{
    protected $fillable = ['user_id', 'code_hash', 'attempts', 'expires_at', 'consumed_at', 'ip'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'consumed_at' => 'datetime', 'attempts' => 'integer'];
    }
}
