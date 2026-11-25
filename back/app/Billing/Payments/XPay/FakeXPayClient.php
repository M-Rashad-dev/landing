<?php

declare(strict_types=1);

namespace App\Billing\Payments\XPay;

use Illuminate\Support\Str;

/**
 * XPay without the network (driver "fake": tests and e2e). Sessions live in memory; a test marks one paid, waiting
 * (Fawry) or expired, and signs webhook bodies with the configured secret like XPay does.
 */
final class FakeXPayClient implements XPayClient
{
    /** @var array<string, array<string, mixed>> */
    public array $sessions = [];

    /** @var list<array{body: array<string, mixed>, key: string}> */
    public array $created = [];

    public ?string $fail = null;

    public bool $ready = true;

    public function configured(): bool
    {
        return $this->ready;
    }

    public function createSession(array $body, string $idempotencyKey): array
    {
        if ($this->fail !== null) {
            throw new XPayError($this->fail);
        }
        $this->created[] = ['body' => $body, 'key' => $idempotencyKey];
        $id = 'cs_test_'.Str::random(22);
        $amount = 0;
        foreach ((array) ($body['lineItems'] ?? []) as $line) {
            $amount += (int) ($line['priceData']['unitAmount'] ?? 0) * (int) ($line['quantity'] ?? 1);
        }

        return $this->sessions[$id] = [
            'id' => $id,
            'object' => 'checkout.session',
            'status' => 'open',
            'paymentStatus' => 'unpaid',
            'url' => 'https://checkout.xpay.app/c/'.$id,
            'amountSubtotal' => $amount,
            'amountTotal' => $amount,
            'currency' => 'EGP',
            'livemode' => false,
            'metadata' => $body['metadata'] ?? [],
            'paymentIntentId' => null,
        ];
    }

    public function getSession(string $id): array
    {
        return $this->sessions[$id] ?? throw new XPayError('XPay 404: No such checkout session.');
    }

    public function signatureValid(string $rawBody, string $header): bool
    {
        return app(HttpXPayClient::class)->signatureValid($rawBody, $header);
    }

    /** The customer paid (card), or finished checkout with Fawry and hasn't paid yet. */
    public function pay(string $id, bool $later = false): void
    {
        $this->sessions[$id]['status'] = 'complete';
        $this->sessions[$id]['paymentStatus'] = $later ? 'unpaid' : 'paid';
        $this->sessions[$id]['paymentIntentId'] = 'pi_test_'.Str::random(16);
    }

    public function expire(string $id): void
    {
        $this->sessions[$id]['status'] = 'expired';
    }

    /** The XPay-Signature header for a body, signed now with the configured secret. */
    public static function sign(string $rawBody, ?int $at = null): string
    {
        $t = (string) ($at ?? time());

        return 't='.$t.',v1='.hash_hmac('sha256', $t.'.'.$rawBody, (string) config('services.xpay.webhook_secret'));
    }
}
