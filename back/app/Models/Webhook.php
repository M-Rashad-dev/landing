<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\WebhookKind;
use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\LockableByPlan;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $tenant_id
 * @property WebhookKind $kind
 * @property string $name
 * @property string $url
 * @property string $secret
 * @property list<string> $events
 * @property bool $is_active
 * @property int $failures_count
 * @property Carbon|null $last_delivery_at
 * @property string|null $last_status
 */
class Webhook extends Model
{
    use BelongsToTenant, LockableByPlan;

    protected $fillable = ['kind', 'name', 'url', 'secret', 'events', 'is_active'];

    protected function casts(): array
    {
        return ['kind' => WebhookKind::class, 'events' => 'array', 'is_active' => 'boolean', 'failures_count' => 'integer', 'last_delivery_at' => 'datetime'];
    }

    /** @return HasMany<WebhookDelivery, $this> */
    public function deliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class);
    }
}
