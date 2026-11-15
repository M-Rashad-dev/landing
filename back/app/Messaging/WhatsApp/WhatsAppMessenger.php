<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

use App\Enums\MessagePurpose;
use App\Enums\MessageStatus;
use App\Models\OutboundMessage;

/**
 * Sends through the WhatsApp gateway and writes every attempt to outbound_messages (never the
 * text or code), so the admin sees what went out and the webhook can follow it to "read".
 */
final class WhatsAppMessenger
{
    public function __construct(private readonly WhatsAppGateway $gateway) {}

    public function configured(): bool
    {
        return $this->gateway->configured();
    }

    /** A sign-in code (template mksab_code). Throws WhatsAppError when it could not be sent. */
    public function sendCode(string $phone, string $code, MessagePurpose $purpose, ?int $tenantId): OutboundMessage
    {
        return $this->deliver($phone, $purpose, WhatsAppTemplates::CODE, $tenantId, fn (): string => $this->gateway->sendTemplate(
            $phone,
            WhatsAppTemplates::CODE,
            WhatsAppTemplates::LANGUAGE,
            WhatsAppTemplates::codeComponents($code),
        ));
    }

    /** Free text inside the 24-hour window after the person wrote to us. Throws WhatsAppError. */
    public function sendText(string $phone, string $body, MessagePurpose $purpose, ?int $tenantId): OutboundMessage
    {
        return $this->deliver($phone, $purpose, null, $tenantId, fn (): string => $this->gateway->sendText($phone, $body));
    }

    /** @param callable(): string $send returns Meta's message id */
    private function deliver(string $phone, MessagePurpose $purpose, ?string $template, ?int $tenantId, callable $send): OutboundMessage
    {
        $message = OutboundMessage::query()->create([
            'tenant_id' => $tenantId,
            'channel' => 'whatsapp',
            'recipient' => $phone,
            'purpose' => $purpose,
            'template' => $template,
            'status' => MessageStatus::Pending,
        ]);

        try {
            $message->update(['provider_id' => $send()]);
        } catch (WhatsAppError $e) {
            $message->update([
                'status' => MessageStatus::Failed,
                'error_code' => mb_substr($e->errorCode, 0, 16),
                'error_title' => mb_substr($e->title, 0, 255),
                'failed_at' => now(),
            ]);

            throw $e;
        }

        return $message;
    }
}
