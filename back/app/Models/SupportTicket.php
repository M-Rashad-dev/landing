<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\SupportStatus;
use App\Enums\SupportTopic;
use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A support conversation of a store with the platform. `number` (id + 1000) is what the
 * merchant quotes; the merchant never sees which admin answered.
 *
 * @property int $id
 * @property int|null $number
 * @property int $tenant_id
 * @property int|null $user_id
 * @property SupportTopic $topic
 * @property SupportStatus $status
 * @property string|null $close_reason merchant | support | auto
 * @property Carbon|null $closed_at
 * @property int|null $closed_by
 * @property int $reopened_count
 * @property Carbon|null $last_message_at
 * @property Carbon|null $last_merchant_message_at
 * @property Carbon|null $last_support_message_at
 * @property Carbon|null $first_response_at
 * @property Carbon|null $merchant_read_at
 * @property Carbon|null $support_read_at
 * @property int|null $rating
 * @property bool|null $rating_resolved
 * @property string|null $rating_comment
 * @property Carbon|null $rated_at
 * @property array<string, mixed>|null $context
 * @property Carbon|null $created_at
 */
class SupportTicket extends Model
{
    use BelongsToTenant;

    public const NUMBER_OFFSET = 1000;

    protected $fillable = [
        'user_id', 'topic', 'status', 'close_reason', 'closed_at', 'closed_by', 'reopened_count', 'last_message_at', 'last_merchant_message_at',
        'last_support_message_at', 'first_response_at', 'merchant_read_at', 'support_read_at', 'rating', 'rating_resolved', 'rating_comment', 'rated_at', 'context',
    ];

    /** Message and read times keep microseconds (other columns simply drop them). */
    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected function casts(): array
    {
        return [
            'topic' => SupportTopic::class,
            'status' => SupportStatus::class,
            'closed_at' => 'datetime',
            'last_message_at' => 'datetime',
            'last_merchant_message_at' => 'datetime',
            'last_support_message_at' => 'datetime',
            'first_response_at' => 'datetime',
            'merchant_read_at' => 'datetime',
            'support_read_at' => 'datetime',
            'rated_at' => 'datetime',
            'rating' => 'integer',
            'rating_resolved' => 'boolean',
            'context' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::created(function (self $ticket): void {
            $ticket->forceFill(['number' => $ticket->id + self::NUMBER_OFFSET])->saveQuietly();
        });
    }

    /** @return HasMany<SupportMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class)->orderBy('id');
    }

    /** @return BelongsTo<Tenant, $this> */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /** The merchant has a reply not read yet. */
    public function unreadForMerchant(): bool
    {
        return $this->last_support_message_at !== null && ($this->merchant_read_at === null || $this->merchant_read_at->lt($this->last_support_message_at));
    }

    /** Support has a merchant message not read yet. */
    public function unreadForSupport(): bool
    {
        return $this->last_merchant_message_at !== null && ($this->support_read_at === null || $this->support_read_at->lt($this->last_merchant_message_at));
    }
}
