<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A one-time sign-in code sent to a phone (only its hash is kept).
 *
 * @property int $id
 * @property string $phone
 * @property string $code_hash
 * @property int $attempts
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 * @property string|null $ip
 * @property Carbon $created_at
 */
class CustomerLoginCode extends Model
{
    use BelongsToTenant;

    protected $fillable = ['phone', 'code_hash', 'attempts', 'expires_at', 'consumed_at', 'ip'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'consumed_at' => 'datetime', 'attempts' => 'integer'];
    }
}
