<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A whole-page / whole-store AI design run (docs/plans/ai-designer.md §3.1 & §4.2).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $chat_id
 * @property array<string, mixed>|null $plan
 * @property string $status queued|images|sections|design|proposed|applied|rejected|failed
 * @property string|null $progress
 * @property array<string, int|string>|null $image_results
 * @property array<string, int>|null $section_ids
 * @property array<string, mixed>|null $proposal
 * @property array<string, mixed>|null $previous_draft
 * @property Carbon|null $applied_at
 * @property Carbon|null $reverted_at
 * @property string|null $error
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read AiChat|null $chat
 */
class AiDesignRun extends Model
{
    use BelongsToTenant;

    public const ACTIVE_STATUSES = ['queued', 'images', 'sections', 'design'];

    protected $fillable = [
        'chat_id',
        'plan',
        'status',
        'progress',
        'image_results',
        'section_ids',
        'proposal',
        'previous_draft',
        'applied_at',
        'reverted_at',
        'error',
    ];

    protected function casts(): array
    {
        return [
            'plan' => 'array',
            'image_results' => 'array',
            'section_ids' => 'array',
            'proposal' => 'array',
            'previous_draft' => 'array',
            'applied_at' => 'datetime',
            'reverted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<AiChat, $this> */
    public function chat(): BelongsTo
    {
        return $this->belongsTo(AiChat::class, 'chat_id');
    }
}
