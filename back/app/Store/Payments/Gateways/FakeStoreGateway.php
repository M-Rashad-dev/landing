<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;

/**
 * Any gateway without the network (payments.driver = fake: tests, e2e, a dev box without accounts). Checkouts live in
 * memory; a test sets their state, and signs webhook bodies with the account's "webhook_secret" (x-fake-signature).
 */
final class FakeStoreGateway implements StoreGateway
{
    /** @var array<string, GatewayResult> by our reference */
    public array $results = [];

    /** @var list<GatewayCheckout> */
    public array $opened = [];

    public ?string $fail = null;

    /** @param list<array{key: string, secret: bool}> $fields */
    public function __construct(private readonly string $key, private readonly string $label, private readonly array $fields) {}

    public function key(): string
    {
        return $this->key;
    }

    public function label(): string
    {
        return $this->label;
    }

    public function credentialFields(): array
    {
        return $this->fields;
    }

    public function connect(array $credentials, string $webhookUrl): GatewayConnection
    {
        foreach ($this->fields as $field) {
            if (trim($credentials[$field['key']] ?? '') === '' || str_contains($credentials[$field['key']], 'wrong')) {
                throw new GatewayError((string) __('payments.gateways.auth', ['gateway' => $this->label]), true);
            }
        }
        $mode = str_contains(implode('', $credentials), 'live') ? 'live' : 'test';

        return new GatewayConnection(array_map('trim', $credentials) + ['webhook_secret' => 'fake-secret'], $mode);
    }

    public function disconnect(StoreGatewayAccount $account): void {}

    public function checkout(StoreGatewayAccount $account, GatewayCheckout $checkout): GatewaySession
    {
        if ($this->fail !== null) {
            throw new GatewayError($this->fail);
        }
        $this->opened[] = $checkout;

        return new GatewaySession('fake_'.$checkout->reference, 'https://pay.example.com/'.$this->key.'/'.$checkout->reference);
    }

    public function status(StoreGatewayAccount $account, StoreOnlinePayment $payment): GatewayResult
    {
        return $this->results[$payment->reference] ?? new GatewayResult(GatewayResult::OPEN);
    }

    /** @var list<array{reference: string, amount: int}> */
    public array $refunded = [];

    public ?string $refundFail = null;

    public function refund(StoreGatewayAccount $account, StoreOnlinePayment $payment, int $amountCents, ?string $reason): GatewayRefund
    {
        if ($this->refundFail !== null) {
            throw new GatewayError($this->refundFail);
        }
        $this->refunded[] = ['reference' => $payment->reference, 'amount' => $amountCents];

        return new GatewayRefund(GatewayRefund::DONE, 'refund_'.count($this->refunded));
    }

    public function webhook(StoreGatewayAccount $account, string $raw, array $headers, array $query): ?array
    {
        if (! hash_equals(self::sign($raw, $account->credential('webhook_secret')), (string) ($headers['x-fake-signature'] ?? ''))) {
            return null;
        }
        $body = json_decode($raw, true);

        return ['reference' => is_array($body) && is_string($body['reference'] ?? null) ? $body['reference'] : null];
    }

    public static function sign(string $raw, string $secret = 'fake-secret'): string
    {
        return hash_hmac('sha256', $raw, $secret);
    }
}
