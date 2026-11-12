<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A storefront sign-in (the browser keeps the token in an httpOnly cookie; only its hash is kept here).
 *
 * @property int $id
 * @property int $customer_id
 * @property string $token_hash
 * @property string|null $user_agent
 * @property Carbon|null $last_used_at
 * @property Carbon $expires_at
 */
class CustomerToken extends Model
{
    use BelongsToTenant;

    protected $fillable = ['customer_id', 'token_hash', 'user_agent', 'last_used_at', 'expires_at'];

    protected function casts(): array
    {
        return ['last_used_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
