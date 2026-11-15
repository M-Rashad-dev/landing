<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

/**
 * Our interface over WhatsApp (owner-approved provider: Meta's WhatsApp Cloud API, keys in .env).
 * Numbers are E.164 (+201…). Every call throws WhatsAppError when Meta refuses or can't be reached.
 */
interface WhatsAppGateway
{
    /** False when the keys are missing here (then nothing can be sent). */
    public function configured(): bool;

    /**
     * Sends an approved template; returns Meta's message id.
     *
     * @param  list<array<string, mixed>>  $components  Meta's "components" (body / button parameters)
     */
    public function sendTemplate(string $to, string $name, string $language, array $components): string;

    /** Free text: only allowed within 24 hours of the person's last message to us. Returns the message id. */
    public function sendText(string $to, string $body): string;

    /**
     * The templates on the account, as Meta has them now.
     *
     * @return list<array{name: string, language: string, status: string, category: string, rejected_reason: string|null}>
     */
    public function templates(): array;

    /**
     * Submits a template for Meta's review; returns its status.
     *
     * @param  array<string, mixed>  $definition
     */
    public function createTemplate(array $definition): string;

    /**
     * The sending number as Meta sees it.
     *
     * @return array{number: string, name: string, name_status: string, quality: string}
     */
    public function phoneNumber(): array;
}
