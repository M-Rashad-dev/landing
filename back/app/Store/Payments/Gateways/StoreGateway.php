<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;

/**
 * An online payment gateway a store connects with its own account (Paymob, Kashier, XPay). One class per gateway; the
 * rest of the platform only talks to this. The customer pays on the gateway's hosted page; whether he paid is always
 * read back from the gateway (status()), never from the browser or a webhook body alone. Failures are GatewayError.
 */
interface StoreGateway
{
    /** Stable key (stored on accounts, methods and payments). */
    public function key(): string;

    /** The gateway's name as merchants know it. */
    public function label(): string;

    /**
     * What the merchant pastes to connect (labels and help in lang payments.gateways.{gateway}.fields.{key}).
     *
     * @return list<array{key: string, secret: bool}>
     */
    public function credentialFields(): array;

    /**
     * Checks the credentials against the gateway (and sets up its webhook when the gateway lets us), and returns what
     * to keep: the credentials (possibly with more, e.g. a webhook signing secret) and test / live.
     *
     * @param  array<string, string>  $credentials
     *
     * @throws GatewayError
     */
    public function connect(array $credentials, string $webhookUrl): GatewayConnection;

    /** Undoes what connect() set up at the gateway (best effort, never throws). */
    public function disconnect(StoreGatewayAccount $account): void;

    /** Opens a hosted checkout for an order. @throws GatewayError */
    public function checkout(StoreGatewayAccount $account, GatewayCheckout $checkout): GatewaySession;

    /** Where a checkout is now, asked from the gateway. @throws GatewayError */
    public function status(StoreGatewayAccount $account, StoreOnlinePayment $payment): GatewayResult;

    /**
     * An authentic webhook call → which checkout it is about (our reference and / or the gateway's id); null when the
     * signature is wrong.
     *
     * @param  array<string, string>  $headers  lower-case names
     * @param  array<string, string>  $query
     * @return array{reference?: string|null, external_id?: string|null}|null
     */
    public function webhook(StoreGatewayAccount $account, string $raw, array $headers, array $query): ?array;
}
