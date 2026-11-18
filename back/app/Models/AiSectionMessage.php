<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A message in an AI section chat: the merchant's (text + up to 3 reference images) or the AI's
 * (pending while it works; may carry the version it proposed).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $chat_id
 * @property string $role user|assistant
 * @property string|null $text
 * @property list<int>|null $media_ids
 * @property string $status pending|done|failed
 * @property int|null $version_id
 * @property int|null $ai_usage_id
 * @property string|null $error
 * @property Carbon $created_at
 * @property-read AiSectionVersion|null $version
 */
class AiSectionMessage extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    /** Reference images per merchant message. */
    public const MAX_IMAGES = 3;

    protected $fillable = ['chat_id', 'role', 'text', 'media_ids', 'status', 'version_id', 'ai_usage_id', 'error'];

    protected function casts(): array
    {
        return ['media_ids' => 'array'];
    }

    /** @return BelongsTo<AiSectionVersion, $this> */
    public function version(): BelongsTo
    {
        return $this->belongsTo(AiSectionVersion::class, 'version_id');
    }
}
