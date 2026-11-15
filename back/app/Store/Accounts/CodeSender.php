<?php

declare(strict_types=1);

namespace App\Store\Accounts;

/**
 * Sends a customer's one-time sign-in code: on WhatsApp when its keys are set
 * (WhatsAppCodeSender), otherwise shown on screen (ScreenCodeSender, never in production).
 */
interface CodeSender
{
    /** The channel name shown to the customer ("screen", "whatsapp"). */
    public function channel(): string;

    /** False when this sender cannot be used here (then signing in is unavailable). */
    public function available(): bool;

    /** Sends the code; returns true when the code must be shown to the visitor instead. */
    public function send(string $phone, string $code, string $storeName, ?int $tenantId): bool;
}
