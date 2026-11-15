<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MessagePurpose;
use App\Enums\MessageStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One message the platform sent (see the migration). Platform-wide: not tenant scoped, only the
 * super admin reads these; tenant_id says which store it was for.
 *
 * @property int $id
 * @property int|null $tenant_id
 * @property string $channel
 * @property string $recipient E.164
 * @property MessagePurpose $purpose
 * @property string|null $template
 * @property string|null $provider_id Meta's message id (wamid)
 * @property MessageStatus $status
 * @property string|null $error_code
 * @property string|null $error_title
 * @property Carbon|null $sent_at
 * @property Carbon|null $delivered_at
 * @property Carbon|null $read_at
 * @property Carbon|null $failed_at
 * @property Carbon $created_at
 */
class OutboundMessage extends Model
{
    protected $fillable = [
        'tenant_id', 'channel', 'recipient', 'purpose', 'template', 'provider_id', 'status',
        'error_code', 'error_title', 'sent_at', 'delivered_at', 'read_at', 'failed_at',
    ];

    protected function casts(): array
    {
        return [
            'purpose' => MessagePurpose::class,
            'status' => MessageStatus::class,
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
