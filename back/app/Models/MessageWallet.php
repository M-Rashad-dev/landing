<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * The store's WhatsApp message balance for cart reminders (bought in packs; one reminder = one message).
 *
 * @property int $balance
 * @property Carbon|null $empty_notified_at
 */
class MessageWallet extends Model
{
    use BelongsToTenant;

    protected $fillable = ['balance', 'empty_notified_at'];

    protected $attributes = ['balance' => 0];

    protected function casts(): array
    {
        return ['balance' => 'integer', 'empty_notified_at' => 'datetime'];
    }
}
