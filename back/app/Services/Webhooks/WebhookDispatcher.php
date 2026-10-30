<?php

declare(strict_types=1);

namespace App\Services\Webhooks;

use App\Enums\WebhookEvent;
use App\Jobs\DeliverWebhook;
use App\Jobs\NotifyAbandonedLead;
use App\Models\AbandonedLead;
use App\Models\Order;
use App\Models\Webhook;
use App\Tenancy\Tenancy;

/** Queues an event for every active integration of the current store subscribed to it (after commit). */
final class WebhookDispatcher
{
    public function __construct(private readonly WebhookPayloads $payloads) {}

    public function order(WebhookEvent $event, Order $order, array $extra = []): void
    {
        $this->dispatch($event, fn () => $this->payloads->order($order) + $extra);
    }

    /** A new abandoned form is reported only if no order follows within 30 minutes. */
    public function lead(AbandonedLead $lead): void
    {
        if (Webhook::query()->where('is_active', true)->whereJsonContains('events', WebhookEvent::LeadCreated->value)->exists()) {
            NotifyAbandonedLead::dispatch((int) Tenancy::id(), $lead->id)->delay(now()->addMinutes(NotifyAbandonedLead::DELAY_MINUTES))->afterCommit();
        }
    }

    public function leadNow(AbandonedLead $lead): void
    {
        $this->dispatch(WebhookEvent::LeadCreated, fn () => $this->payloads->lead($lead));
    }

    /** @param callable(): array<string, mixed> $data built only when someone listens */
    private function dispatch(WebhookEvent $event, callable $data): void
    {
        $webhooks = Webhook::query()->where('is_active', true)->get(['id', 'events'])->filter(fn (Webhook $w) => in_array($event->value, $w->events, true));
        if ($webhooks->isEmpty()) {
            return;
        }

        $payload = $data();
        foreach ($webhooks as $webhook) {
            DeliverWebhook::dispatch((int) Tenancy::id(), $webhook->id, $event->value, $payload)->afterCommit();
        }
    }
}
