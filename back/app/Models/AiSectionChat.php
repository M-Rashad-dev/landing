<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The chat between a merchant and the AI that makes (ai_section_id null until the first
 * approval) or edits one AI section, on one theme.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $kind
 * @property string $theme_key
 * @property int|null $ai_section_id
 * @property int|null $landing_page_id
 */
class AiSectionChat extends Model
{
    use BelongsToTenant;

    /** Messages a chat keeps (merchant + AI). */
    public const MAX_MESSAGES = 40;

    protected $fillable = ['kind', 'theme_key', 'ai_section_id', 'landing_page_id'];

    /** @return HasMany<AiSectionMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(AiSectionMessage::class, 'chat_id');
    }

    /** @return BelongsTo<AiSection, $this> */
    public function section(): BelongsTo
    {
        return $this->belongsTo(AiSection::class, 'ai_section_id');
    }
}
