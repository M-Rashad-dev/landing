<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * A support conversation changed (new message, read, closed, reopened, rated): sent at once to the
 * store's channel and to the platform support's channel. The merchant's copy never names an admin.
 */
final class SupportUpdated implements ShouldBroadcastNow
{
    /**
     * @param  array<string, mixed>  $ticket  the ticket row
     * @param  array<string, mixed>|null  $message  the new message row, if any
     */
    public function __construct(
        public readonly int $tenantId,
        public readonly array $ticket,
        public readonly ?array $message = null,
    ) {}

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('support.tenant.'.$this->tenantId), new PrivateChannel('support.admin')];
    }

    public function broadcastAs(): string
    {
        return 'support.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return ['ticket' => $this->ticket, 'message' => $this->message];
    }
}
