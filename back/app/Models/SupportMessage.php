<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One message of a support conversation: from the merchant, from support, or a system line
 * ("closed", "reopened").
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $support_ticket_id
 * @property string $sender merchant | support | system
 * @property int|null $user_id
 * @property string|null $body
 * @property Carbon|null $created_at
 */
class SupportMessage extends Model
{
    use BelongsToTenant;

    public const MERCHANT = 'merchant';

    public const SUPPORT = 'support';

    public const SYSTEM = 'system';

    protected $fillable = ['support_ticket_id', 'sender', 'user_id', 'body'];

    /** @return HasMany<SupportAttachment, $this> */
    public function attachments(): HasMany
    {
        return $this->hasMany(SupportAttachment::class)->orderBy('id');
    }

    /** @return BelongsTo<SupportTicket, $this> */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }
}
