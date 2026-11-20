<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * An Excel file the copilot built (a report or a list), downloadable by its token until it expires
 * (`copilot:prune` deletes it after).
 *
 * @property int $id
 * @property int $tenant_id
 * @property int|null $user_id
 * @property int|null $chat_id
 * @property string $token
 * @property string $filename
 * @property string $path
 * @property int $rows_count
 * @property Carbon $expires_at
 * @property Carbon $created_at
 */
class CopilotExport extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    /** How long a file can be downloaded. */
    public const HOURS = 24;

    protected $fillable = ['user_id', 'chat_id', 'token', 'filename', 'path', 'rows_count', 'expires_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }
}
