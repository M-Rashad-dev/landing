<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Something moved in the user's copilot (a reply's progress, a reply done, a change applied): the dashboard
 * refetches. Sent on the user's own channel (the bell's), so nothing new to authorise.
 */
final class CopilotUpdated implements ShouldBroadcastNow
{
    public function __construct(
        public readonly int $userId,
        public readonly int $chatId,
        public readonly ?int $messageId = null,
        public readonly ?int $changeSetId = null,
    ) {}

    /** Sends it; the realtime server being down never blocks the copilot (the screens poll as a fallback). */
    public static function notify(int $userId, int $chatId, ?int $messageId = null, ?int $changeSetId = null): void
    {
        try {
            event(new self($userId, $chatId, $messageId, $changeSetId));
        } catch (Throwable $e) {
            Log::warning('copilot broadcast failed', ['chat' => $chatId, 'error' => $e->getMessage()]);
        }
    }

    /** @return list<PrivateChannel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    public function broadcastAs(): string
    {
        return 'copilot.updated';
    }

    /** @return array<string, int|null> */
    public function broadcastWith(): array
    {
        return ['chat_id' => $this->chatId, 'message_id' => $this->messageId, 'change_set_id' => $this->changeSetId];
    }
}
