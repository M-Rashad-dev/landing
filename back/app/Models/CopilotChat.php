<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A dashboard user's chat with the store copilot (docs/plans/ai-copilot.md): one open chat per
 * user; «محادثة جديدة» closes it and opens an empty one.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $user_id
 * @property string|null $title
 * @property Carbon|null $closed_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class CopilotChat extends Model
{
    use BelongsToTenant;

    /** Messages a chat keeps (merchant + assistant) before a new one is needed. */
    public const MAX_MESSAGES = 80;

    protected $fillable = ['user_id', 'title', 'closed_at'];

    protected function casts(): array
    {
        return ['closed_at' => 'datetime'];
    }

    /** @return HasMany<CopilotMessage, $this> */
    public function messages(): HasMany
    {
        return $this->hasMany(CopilotMessage::class, 'chat_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
