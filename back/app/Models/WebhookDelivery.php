<?php

declare(strict_types=1);

namespace App\Models;

use App\Models\Concerns\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $webhook_id
 * @property string $event
 * @property string $status
 * @property int|null $response_code
 * @property string|null $error
 * @property int $attempt
 * @property int $duration_ms
 * @property Carbon $created_at
 */
class WebhookDelivery extends Model
{
    use BelongsToTenant;

    public const UPDATED_AT = null;

    /** Log entries kept per webhook. */
    public const KEEP = 50;

    protected $fillable = ['webhook_id', 'event', 'status', 'response_code', 'error', 'attempt', 'duration_ms'];
}
