<?php

declare(strict_types=1);

namespace App\Billing\Payments\XPay;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/** XPay over HTTPS with the secret key (Bearer). Amounts are in minor units (piasters). */
final class HttpXPayClient implements XPayClient
{
    /** Webhook timestamps older (or newer) than this are refused (replay protection, XPay's own window). */
    private const TOLERANCE_SECONDS = 300;

    public function configured(): bool
    {
        return $this->key() !== '';
    }

    public function createSession(array $body, string $idempotencyKey): array
    {
        return $this->json(fn () => $this->http()->withHeaders(['Idempotency-Key' => $idempotencyKey])->post('/checkout/sessions', $body));
    }

    public function getSession(string $id): array
    {
        if (preg_match('/^cs_(test|live)_[A-Za-z0-9]{6,80}$/', $id) !== 1) {
            throw new XPayError('Invalid checkout session id.');
        }

        return $this->json(fn () => $this->http()->get('/checkout/sessions/'.$id));
    }

    public function signatureValid(string $rawBody, string $header): bool
    {
        $secret = (string) config('services.xpay.webhook_secret');
        if ($secret === '' || $rawBody === '' || $header === '') {
            return false;
        }
        $parts = [];
        foreach (explode(',', $header) as $pair) {
            [$k, $v] = array_pad(explode('=', trim($pair), 2), 2, '');
            $parts[$k][] = $v;
        }
        $timestamp = (string) ($parts['t'][0] ?? '');
        if (! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > self::TOLERANCE_SECONDS) {
            return false;
        }
        $expected = hash_hmac('sha256', $timestamp.'.'.$rawBody, $secret);
        foreach ($parts['v1'] ?? [] as $signature) {
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        return false;
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.xpay.base_url'), '/'))
            ->withToken($this->key())
            ->acceptJson()
            ->asJson()
            ->timeout(max(5, (int) config('services.xpay.timeout', 20)));
    }

    /**
     * @param  callable(): Response  $call
     * @return array<string, mixed>
     */
    private function json(callable $call): array
    {
        if (! $this->configured()) {
            throw new XPayError('XPay is not configured.');
        }
        try {
            $response = $call();
        } catch (ConnectionException $e) {
            throw new XPayError('XPay unreachable: '.$e->getMessage());
        }
        if (! $response->successful() || ! is_array($response->json())) {
            $error = $response->json('error.message') ?? $response->json('message') ?? $response->body();
            throw new XPayError('XPay '.$response->status().': '.mb_substr(is_string($error) ? $error : json_encode($error), 0, 300));
        }

        return $response->json();
    }

    private function key(): string
    {
        return trim((string) config('services.xpay.secret_key'));
    }
}
