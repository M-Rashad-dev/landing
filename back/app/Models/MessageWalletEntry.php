<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One move of the message balance: topup (a paid pack) · charge (a reminder sent) · refund (it failed) · adjust (admin).
 *
 * @property int $id
 * @property string $type
 * @property int $messages
 * @property int $balance_after
 * @property string|null $description
 * @property int|null $invoice_id
 * @property Carbon $created_at
 */
class MessageWalletEntry extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    public const TYPES = ['topup', 'charge', 'refund', 'adjust'];

    protected $fillable = ['type', 'messages', 'balance_after', 'description', 'invoice_id'];

    protected function casts(): array
    {
        return ['messages' => 'integer', 'balance_after' => 'integer', 'created_at' => 'datetime'];
    }
}
