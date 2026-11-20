<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * One change the copilot prepared (docs/plans/ai-copilot.md §3.6): drafts it created, an update
 * waiting for the merchant's «نفّذ», a special action, a costly job, or the revert of an applied one.
 * Its items hold each record's before / after values.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int|null $chat_id
 * @property int|null $message_id
 * @property int|null $user_id
 * @property string $kind create|update|action|revert|job
 * @property string $target
 * @property string $summary
 * @property array<string, mixed> $spec
 * @property string $status
 * @property bool $keep_draft
 * @property bool $reversible
 * @property list<array{key: string, count: int, text: string}>|null $side_effects
 * @property int|null $estimate_cents
 * @property int $items_count
 * @property int $applied_count
 * @property int $skipped_count
 * @property int $failed_count
 * @property int|null $reverts_id
 * @property Carbon|null $expires_at
 * @property Carbon|null $decided_at
 * @property Carbon|null $applied_at
 * @property Carbon|null $reverted_at
 * @property int|null $decided_by
 * @property string|null $error
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class CopilotChangeSet extends Model
{
    use BelongsToTenant;

    public const KIND_CREATE = 'create';

    public const KIND_UPDATE = 'update';

    public const KIND_ACTION = 'action';

    public const KIND_REVERT = 'revert';

    public const KIND_JOB = 'job';

    public const STATUS_ESTIMATE = 'estimate';

    public const STATUS_RUNNING = 'running';

    public const STATUS_PROPOSED = 'proposed';

    public const STATUS_APPLYING = 'applying';

    public const STATUS_APPLIED = 'applied';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_FAILED = 'failed';

    public const STATUS_REVERTED = 'reverted';

    /** The most records one change may touch. */
    public const MAX_ITEMS = 5000;

    /** Proposed changes a store may have waiting at once. */
    public const MAX_OPEN = 10;

    /** How long a proposal waits for «نفّذ». */
    public const PROPOSAL_HOURS = 24;

    /** How long after it was applied a change can be reverted (owner, 2026-11-20). */
    public const REVERT_HOURS = 24;

    protected $fillable = [
        'chat_id', 'message_id', 'user_id', 'kind', 'target', 'summary', 'spec', 'status', 'keep_draft', 'reversible',
        'side_effects', 'estimate_cents', 'items_count', 'applied_count', 'skipped_count', 'failed_count', 'reverts_id',
        'expires_at', 'decided_at', 'applied_at', 'reverted_at', 'decided_by', 'error',
    ];

    protected function casts(): array
    {
        return [
            'spec' => 'array',
            'side_effects' => 'array',
            'keep_draft' => 'boolean',
            'reversible' => 'boolean',
            'expires_at' => 'datetime',
            'decided_at' => 'datetime',
            'applied_at' => 'datetime',
            'reverted_at' => 'datetime',
        ];
    }

    /** @return HasMany<CopilotChangeItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(CopilotChangeItem::class, 'change_set_id');
    }

    /** @return BelongsTo<CopilotChat, $this> */
    public function chat(): BelongsTo
    {
        return $this->belongsTo(CopilotChat::class, 'chat_id');
    }

    /** @return BelongsTo<CopilotMessage, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(CopilotMessage::class, 'message_id');
    }

    /** @return BelongsTo<self, $this> */
    public function reverts(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reverts_id');
    }
}
