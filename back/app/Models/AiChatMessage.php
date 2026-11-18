<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A message in an AI designer chat: the merchant's (text + reference images) or the AI's
 * (pending while it works; may carry a proposed section version, plan, or run).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $chat_id
 * @property string $role user|assistant
 * @property string|null $text
 * @property list<int>|null $media_ids
 * @property int|null $focus_section_id
 * @property string $status pending|done|failed
 * @property int|null $version_id
 * @property int|null $run_id
 * @property array<string, mixed>|null $plan
 * @property int|null $ai_usage_id
 * @property string|null $error
 * @property Carbon $created_at
 * @property-read AiSectionVersion|null $version
 * @property-read AiSection|null $focus
 */
class AiChatMessage extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    /** Reference images per merchant message. */
    public const MAX_IMAGES = 3;

    protected $fillable = [
        'chat_id',
        'role',
        'text',
        'media_ids',
        'focus_section_id',
        'status',
        'version_id',
        'run_id',
        'plan',
        'ai_usage_id',
        'error',
    ];

    protected function casts(): array
    {
        return [
            'media_ids' => 'array',
            'plan' => 'array',
        ];
    }

    /** @return BelongsTo<AiChat, $this> */
    public function chat(): BelongsTo
    {
        return $this->belongsTo(AiChat::class, 'chat_id');
    }

    /** @return BelongsTo<AiSectionVersion, $this> */
    public function version(): BelongsTo
    {
        return $this->belongsTo(AiSectionVersion::class, 'version_id');
    }

    /** @return BelongsTo<AiSection, $this> */
    public function focus(): BelongsTo
    {
        return $this->belongsTo(AiSection::class, 'focus_section_id');
    }
}
