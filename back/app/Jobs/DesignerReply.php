<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\Designer\AiDesigner;
use App\Models\AiChatMessage;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Throwable;

/**
 * Generates the AI designer's reply for a pending assistant message inside the store's tenant context.
 */
final class DesignerReply implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 1;

    public int $timeout = 240;

    public function __construct(
        public readonly int $tenantId,
        public readonly int $messageId,
    ) {}

    public function handle(AiDesigner $designer): void
    {
        Tenancy::runAs($this->tenantId, function () use ($designer): void {
            $message = AiChatMessage::query()->with('chat')->find($this->messageId);
            if ($message instanceof AiChatMessage) {
                $designer->reply($message);
            }
        });
    }

    public function failed(Throwable $e): void
    {
        Tenancy::runAs($this->tenantId, function (): void {
            $message = AiChatMessage::query()->find($this->messageId);
            if ($message instanceof AiChatMessage && $message->status === 'pending') {
                $message->forceFill([
                    'status' => 'failed',
                    'error' => __('ai.designer.unavailable'),
                ])->save();
            }
        });
    }
}
