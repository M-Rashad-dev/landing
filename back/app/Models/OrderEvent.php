<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ContactResult;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A contact attempt on an order (call-center timeline).
 *
 * @property int $id
 * @property int $order_id
 * @property int|null $user_id
 * @property ContactResult $type
 * @property string|null $note
 * @property Carbon|null $follow_up_at
 * @property Carbon $created_at
 */
class OrderEvent extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    protected $fillable = ['order_id', 'user_id', 'type', 'note', 'follow_up_at'];

    protected function casts(): array
    {
        return ['type' => ContactResult::class, 'follow_up_at' => 'datetime', 'created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
