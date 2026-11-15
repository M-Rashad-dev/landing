<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\NotificationEvent;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * A bell notification of one dashboard user. Always read through the signed-in user's id
 * (never by id alone), so a user only ever sees their own.
 *
 * @property int $id
 * @property int $user_id
 * @property int|null $tenant_id
 * @property NotificationEvent $event
 * @property string $title
 * @property string $body
 * @property string|null $link app path, e.g. /dashboard/orders/12
 * @property array{rows?: list<array{label: string, value: string}>, action?: string|null, whatsapp?: array{template: string, params: list<string>, button: string|null}|null}|null $payload
 * @property string|null $dedupe_key
 * @property Carbon|null $read_at
 * @property Carbon $created_at
 */
class UserNotification extends Model
{
    protected $fillable = ['user_id', 'tenant_id', 'event', 'title', 'body', 'link', 'payload', 'dedupe_key', 'read_at'];

    protected function casts(): array
    {
        return ['event' => NotificationEvent::class, 'payload' => 'array', 'read_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array<string, mixed> */
    public function toBell(): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event->value,
            'title' => $this->title,
            'body' => $this->body,
            'link' => $this->link,
            'read' => $this->read_at !== null,
            'created_at' => $this->created_at->toIso8601ZuluString(),
        ];
    }
}
