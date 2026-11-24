<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

/**
 * A phone or email that asked this store for no more cart reminders.
 *
 * @property string|null $phone
 * @property string|null $email
 */
class RecoveryOptOut extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $fillable = ['phone', 'email'];

    public static function blocks(?string $phone, ?string $email): bool
    {
        $phone = $phone ?: null;
        $email = $email ? mb_strtolower($email) : null;
        if ($phone === null && $email === null) {
            return false;
        }

        return self::query()->where(fn ($q) => $q->when($phone !== null, fn ($w) => $w->orWhere('phone', $phone))->when($email !== null, fn ($w) => $w->orWhere('email', $email)))->exists();
    }
}
