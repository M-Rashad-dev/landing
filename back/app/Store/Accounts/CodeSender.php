<?php

declare(strict_types=1);

namespace App\Store\Accounts;

/**
 * Sends a customer's one-time sign-in code. The WhatsApp and SMS senders plug in here once the
 * owner picks the providers (keys in .env only); until then the code is shown on screen (never
 * in production).
 */
interface CodeSender
{
    /** The channel name shown to the customer ("screen", "whatsapp", "sms"). */
    public function channel(): string;

    /** False when this sender cannot be used here (then signing in is unavailable). */
    public function available(): bool;

    /** Sends the code; returns true when the code must be shown to the visitor instead. */
    public function send(string $phone, string $code, string $storeName): bool;
}
