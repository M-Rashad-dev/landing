<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A message in a copilot chat: the merchant's (text, images, a sheet, the page he was on) or the
 * assistant's (pending while it works, then its text and the server-built cards in `blocks`).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int $chat_id
 * @property string $role user|assistant
 * @property string|null $text
 * @property array<string, mixed>|null $context
 * @property array{media_ids?: list<int>, import_id?: int|null}|null $attachments
 * @property list<array<string, mixed>>|null $blocks
 * @property string $status pending|done|failed
 * @property string|null $progress
 * @property array<string, mixed>|null $trace
 * @property string|null $error
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read CopilotChat $chat
 */
class CopilotMessage extends Model
{
    use BelongsToTenant;

    /** Reference images per merchant message. */
    public const MAX_IMAGES = 4;

    /** A reply still pending after this long is marked failed (nothing was charged for it). */
    public const PENDING_MINUTES = 5;

    protected $fillable = ['chat_id', 'role', 'text', 'context', 'attachments', 'blocks', 'status', 'progress', 'trace', 'error'];

    protected function casts(): array
    {
        return [
            'context' => 'array',
            'attachments' => 'array',
            'blocks' => 'array',
            'trace' => 'array',
        ];
    }

    /** @return BelongsTo<CopilotChat, $this> */
    public function chat(): BelongsTo
    {
        return $this->belongsTo(CopilotChat::class, 'chat_id');
    }

    /** @return list<int> */
    public function mediaIds(): array
    {
        return array_values(array_map('intval', (array) ($this->attachments['media_ids'] ?? [])));
    }
}
