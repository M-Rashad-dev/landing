<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Webhook;
use App\Services\Webhooks\WebhookSender;
use App\Tenancy\Tenancy;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** Delivers one event to one webhook; retried after 1 min, 5 min and 30 min. */
final class DeliverWebhook implements ShouldQueue
{
    use Queueable;

    public const RETRY_DELAYS = [60, 300, 1800];

    public int $tries = 4;

    /** @param array<string, mixed> $data */
    public function __construct(public readonly int $tenantId, public readonly int $webhookId, public readonly string $event, public readonly array $data) {}

    public function handle(WebhookSender $sender): void
    {
        Tenancy::runAs($this->tenantId, function () use ($sender): void {
            $webhook = Webhook::query()->whereKey($this->webhookId)->where('is_active', true)->servable()->first();
            if ($webhook === null) {
                return;
            }

            $attempt = $this->attempts();
            $delivery = $sender->send($webhook, $this->event, $this->data, $attempt);
            if ($delivery->status !== 'success' && $attempt < $this->tries) {
                $this->release(self::RETRY_DELAYS[$attempt - 1] ?? 1800);
            }
        });
    }
}
