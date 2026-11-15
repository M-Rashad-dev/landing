<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Enums\MessagePurpose;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Models\OutboundMessage;
use App\Models\Tenant;
use App\Services\PublicSite;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Someone wrote to the Mksab number (nobody reads it): tell them so, and send them to the store
 * that last messaged this phone. Free (inside the 24 hours after their message). Best effort.
 */
final class SendWhatsAppAutoReply implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public function __construct(public readonly string $phone) {}

    public function handle(WhatsAppMessenger $messenger, PublicSite $site): void
    {
        if (! $messenger->configured()) {
            return;
        }

        $tenantId = OutboundMessage::query()
            ->where('recipient', $this->phone)
            ->whereNotNull('tenant_id')
            ->latest('id')
            ->value('tenant_id');
        $tenantId = $tenantId === null ? null : (int) $tenantId;

        $store = $tenantId === null ? null : Tenant::query()->whereKey($tenantId)->value('name');
        $host = $tenantId === null ? null : $site->primaryHost($tenantId);

        $text = $store !== null && $host !== null
            ? __('messaging.auto_reply.store', ['store' => $store, 'url' => (string) config('landing.public_scheme').'://'.$host])
            : __('messaging.auto_reply.generic');

        try {
            $messenger->sendText($this->phone, $text, MessagePurpose::AutoReply, $tenantId);
        } catch (WhatsAppError) {
            // Already written to the message log as failed; a missed auto reply needs no retry.
        }
    }
}
