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
    public function __construct(
        private readonly WhatsAppGateway $gateway,
        private readonly WhatsAppTemplateStatus $templates,
    ) {}

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

    /**
     * A utility template from WhatsAppTemplates (by its key) with its values. Throws WhatsAppError.
     *
     * @param  list<string>  $params
     * @param  list<string>  $payloads  what each reply button sends back (confirmation messages)
     */
    public function sendTemplate(string $phone, string $key, array $params, ?string $button, MessagePurpose $purpose, ?int $tenantId, ?int $orderId = null, array $payloads = []): OutboundMessage
    {
        $name = WhatsAppTemplates::name($key);
        // A new version waiting for Meta (or put under Marketing): the approved old one goes out.
        $previous = WhatsAppTemplates::previous($key, $params);
        if ($previous !== null && ! $this->templates->approvedUtility($name)) {
            ['name' => $name, 'params' => $params] = $previous;
        }

        return $this->deliver($phone, $purpose, $name, $tenantId, fn (): string => $this->gateway->sendTemplate(
            $phone,
            $name,
            WhatsAppTemplates::LANGUAGE,
            WhatsAppTemplates::components($key, $params, $button, $payloads),
        ), $orderId);
    }

    /** An order email that went out (logged next to the WhatsApp ones, on its order). */
    /** @param  string|null  $via  the mailbox it left from (StoreMailMode: platform | smtp) */
    public function logEmail(string $email, MessagePurpose $purpose, int $tenantId, ?int $orderId, ?string $via = null): OutboundMessage
    {
        return OutboundMessage::query()->create([
            'tenant_id' => $tenantId,
            'order_id' => $orderId,
            'channel' => 'email',
            'via' => $via,
            'recipient' => mb_substr($email, 0, 191),
            'purpose' => $purpose,
            'status' => MessageStatus::Sent,
            'sent_at' => now(),
        ]);
    }

    /** Free text inside the 24-hour window after the person wrote to us. Throws WhatsAppError. */
    public function sendText(string $phone, string $body, MessagePurpose $purpose, ?int $tenantId, ?int $orderId = null): OutboundMessage
    {
        return $this->deliver($phone, $purpose, null, $tenantId, fn (): string => $this->gateway->sendText($phone, $body), $orderId);
    }

    /** @param callable(): string $send returns Meta's message id */
    private function deliver(string $phone, MessagePurpose $purpose, ?string $template, ?int $tenantId, callable $send, ?int $orderId = null): OutboundMessage
    {
        $message = OutboundMessage::query()->create([
            'tenant_id' => $tenantId,
            'order_id' => $orderId,
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
