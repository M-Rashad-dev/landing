<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Ai\Copilot\CopilotEngine;
use App\Models\CopilotMessage;
use App\Tenancy\Tenancy;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Throwable;

/** The store copilot's reply to a pending assistant message, inside the store's tenant. */
final class CopilotReply implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;

    public int $tries = 1;

    public int $timeout = 300;

    public function __construct(public readonly int $tenantId, public readonly int $messageId) {}

    public function handle(CopilotEngine $engine): void
    {
        Tenancy::runAs($this->tenantId, function () use ($engine): void {
            $message = CopilotMessage::query()->with('chat')->find($this->messageId);
            if ($message instanceof CopilotMessage) {
                $engine->reply($message);
            }
        });
    }

    public function failed(Throwable $e): void
    {
        Tenancy::runAs($this->tenantId, function (): void {
            $message = CopilotMessage::query()->find($this->messageId);
            if ($message instanceof CopilotMessage && $message->status === 'pending') {
                $message->forceFill(['status' => 'failed', 'progress' => null, 'error' => __('ai.copilot.unavailable')])->save();
            }
        });
    }
}
