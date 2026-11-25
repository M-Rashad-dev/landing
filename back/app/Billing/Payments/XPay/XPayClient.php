<?php

declare(strict_types=1);

namespace App\Billing\Payments\XPay;

/**
 * The XPay API as the platform uses it (https://docs.xpay.app): hosted checkout sessions and their webhook signature.
 * HttpXPayClient talks to XPay; FakeXPayClient (driver "fake") stands in for tests and e2e.
 */
interface XPayClient
{
    /** The secret key is set (test or live). */
    public function configured(): bool;

    /**
     * Creates a hosted checkout session.
     *
     * @param  array<string, mixed>  $body  POST /checkout/sessions
     * @return array<string, mixed> the session (id, url, status, paymentStatus, amountTotal, currency, livemode…)
     *
     * @throws XPayError
     */
    public function createSession(array $body, string $idempotencyKey): array;

    /**
     * A session as XPay has it now (the source of truth for its payment).
     *
     * @return array<string, mixed>
     *
     * @throws XPayError
     */
    public function getSession(string $id): array;

    /** The XPay-Signature header ("t=…,v1=…") is valid for these exact bytes and recent (5 minutes). */
    public function signatureValid(string $rawBody, string $header): bool;
}
