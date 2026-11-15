<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/** A new bell notification, sent at once to its user's own channel. */
final class NotificationCreated implements ShouldBroadcastNow
{
    /** @param  array<string, mixed>  $notification  UserNotification::toBell() */
    public function __construct(public readonly int $userId, public readonly array $notification) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'notification.created';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['notification' => $this->notification];
    }
}
