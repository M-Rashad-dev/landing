<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One record of a copilot change: the values of the changed fields before and after (the applier
 * writes `after` as it is and skips the record when its `before` no longer matches).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $change_set_id
 * @property string $entity_type
 * @property int|null $entity_id
 * @property string $label
 * @property array<string, mixed>|null $before
 * @property array<string, mixed>|null $after
 * @property string $status
 * @property string|null $note
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class CopilotChangeItem extends Model
{
    use BelongsToTenant;

    public const PENDING = 'pending';

    public const APPLIED = 'applied';

    public const SKIPPED_STALE = 'skipped_stale';

    public const SKIPPED_INVALID = 'skipped_invalid';

    public const FAILED = 'failed';

    public const REVERTED = 'reverted';

    public const KEPT = 'kept';

    protected $fillable = ['change_set_id', 'entity_type', 'entity_id', 'label', 'before', 'after', 'status', 'note'];

    protected function casts(): array
    {
        return ['before' => 'array', 'after' => 'array'];
    }

    /** @return BelongsTo<CopilotChangeSet, $this> */
    public function changeSet(): BelongsTo
    {
        return $this->belongsTo(CopilotChangeSet::class, 'change_set_id');
    }
}
