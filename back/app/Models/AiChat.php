<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * The chat between a merchant and the AI designer: one open chat per store per theme,
 * or one per landing page.
 *
 * @property int $id
 * @property int $tenant_id
 * @property string $kind store|landing
 * @property string $theme_key
 * @property int|null $landing_page_id
 * @property Carbon|null $closed_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class AiChat extends Model
{
    use BelongsToTenant;

    /** Messages a chat keeps (merchant + AI). */
    public const MAX_MESSAGES = 60;

    protected $fillable = ['kind', 'theme_key', 'landing_page_id', 'closed_at'];

    protected function casts(): array
    {
        return ['closed_at' => 'datetime'];
    }

    /** @return HasMany<AiChatMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(AiChatMessage::class, 'chat_id');
    }

    /** @return BelongsTo<LandingPage, $this> */
    public function landingPage(): BelongsTo
    {
        return $this->belongsTo(LandingPage::class, 'landing_page_id');
    }
}
