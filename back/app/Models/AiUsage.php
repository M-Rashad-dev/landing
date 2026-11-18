<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One call to the AI provider and its cost (written by App\Ai\Ai). A platform log for the super
 * admin, not a tenant table: tenant_id only says whose request it was (see its migration).
 *
 * @property int $id
 * @property int|null $tenant_id
 * @property string $feature
 * @property string $model
 * @property int $input_tokens
 * @property int $cached_tokens
 * @property int $output_tokens
 * @property int $images
 * @property string $cost_usd
 * @property bool $ok
 * @property string|null $error
 * @property Carbon $created_at
 */
class AiUsage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['tenant_id', 'feature', 'model', 'input_tokens', 'cached_tokens', 'output_tokens', 'images', 'cost_usd', 'ok', 'error'];

    protected function casts(): array
    {
        return ['ok' => 'boolean', 'created_at' => 'datetime', 'input_tokens' => 'integer', 'cached_tokens' => 'integer', 'output_tokens' => 'integer', 'images' => 'integer'];
    }
}
