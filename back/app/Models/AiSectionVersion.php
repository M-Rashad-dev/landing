<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * One design of an AI section: what the AI proposed, sanitized (template, scoped CSS, fields).
 * proposed → approved (becomes the section's current one) | rejected; an approved one becomes
 * «replaced» when a later edit is approved.
 *
 * @property int $id
 * @property int $tenant_id
 * @property int|null $chat_id
 * @property int|null $ai_section_id
 * @property string $name
 * @property string $html
 * @property string $css_raw
 * @property string $css
 * @property list<array<string, mixed>> $fields
 * @property string $status
 * @property Carbon|null $decided_at
 * @property Carbon $created_at
 */
class AiSectionVersion extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    public const STATUSES = ['proposed', 'approved', 'rejected', 'replaced'];

    protected $fillable = ['chat_id', 'ai_section_id', 'name', 'html', 'css_raw', 'css', 'fields', 'status', 'decided_at'];

    protected function casts(): array
    {
        return ['fields' => 'array', 'decided_at' => 'datetime'];
    }

    /** What pages and the Builder need to draw it. @return array<string, mixed> */
    public function definition(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'html' => $this->html, 'css' => $this->css, 'fields' => $this->fields];
    }

    /** @return BelongsTo<AiChat, $this> */
    public function chat(): BelongsTo
    {
        return $this->belongsTo(AiChat::class, 'chat_id');
    }

    /** @return BelongsTo<AiSection, $this> */
    public function section(): BelongsTo
    {
        return $this->belongsTo(AiSection::class, 'ai_section_id');
    }
}
