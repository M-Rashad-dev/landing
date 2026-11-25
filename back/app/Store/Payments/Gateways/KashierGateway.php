<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;
use App\Support\Money;
use Illuminate\Http\Client\PendingRequest;

/**
 * Kashier (Egypt, developers.kashier.io): a payment session (POST /v3/payment/sessions, `Authorization: {secret key}`
 * + `api-key: {payment API key}`) opened at its sessionUrl; the webhook is signed with HMAC-SHA256 (Payment API Key)
 * over data.signatureKeys sorted, as key=urlencoded(value)&…; the result is read back with
 * GET /v3/payment/sessions/{id}/payment. Test keys run on the test- hosts.
 */
final class KashierGateway extends HttpGateway
{
    public const TEST = 'https://test-api.kashier.io';

    public const LIVE = 'https://api.kashier.io';

    public function key(): string
    {
        return 'kashier';
    }

    public function label(): string
    {
        return 'Kashier';
    }

    public function credentialFields(): array
    {
        return [
            ['key' => 'merchant_id', 'secret' => false],
            ['key' => 'api_key', 'secret' => true],
            ['key' => 'secret_key', 'secret' => true],
        ];
    }

    public function connect(array $credentials, string $webhookUrl): GatewayConnection
    {
        $mid = trim($credentials['merchant_id'] ?? '');
        $api = trim($credentials['api_key'] ?? '');
        $secret = trim($credentials['secret_key'] ?? '');
        if (preg_match('/^MID-[\w-]+$/i', $mid) !== 1 || $api === '' || $secret === '') {
            throw new GatewayError((string) __('payments.gateways.kashier.keys'), true);
        }
        // New secret keys say their mode; older ones are tried on the test host, then live.
        $mode = str_starts_with($secret, 'ksk_live_') ? 'live' : (str_starts_with($secret, 'ksk_test_') ? 'test' : null);
        $keep = ['merchant_id' => strtoupper($mid), 'api_key' => $api, 'secret_key' => $secret];
        foreach ($mode === null ? ['test', 'live'] : [$mode] as $try) {
            try {
                $this->send(fn () => $this->http($try === 'live' ? self::LIVE : self::TEST)->withHeaders(['Authorization' => $secret, 'api-key' => $api])->get('/v3/payment/sessions', ['limit' => 1]));

                return new GatewayConnection($keep + ['mode' => $try], $try);
            } catch (GatewayError $e) {
                if (! $e->auth || $try === 'live' || $mode !== null) {
                    throw $e;
                }
            }
        }

        throw new GatewayError((string) __('payments.gateways.auth', ['gateway' => $this->label()]), true);
    }

    public function checkout(StoreGatewayAccount $account, GatewayCheckout $checkout): GatewaySession
    {
        $session = $this->send(fn () => $this->client($account)->post('/v3/payment/sessions', [
            'expireAt' => now()->addDay()->utc()->format('Y-m-d\TH:i:s.v\Z'),
            'maxFailureAttempts' => 3,
            'paymentType' => 'credit',
            'amount' => Money::toDecimal($checkout->amountCents),
            'currency' => 'EGP',
            'order' => $checkout->reference,
            'merchantId' => $account->credential('merchant_id'),
            'merchantRedirect' => $checkout->returnUrl,
            'failureRedirect' => false,
            'display' => 'ar',
            'type' => 'one-time',
            'description' => mb_substr($checkout->description, 0, 120),
            'customer' => ['email' => $checkout->customerEmail ?: 'customer@example.com', 'reference' => $checkout->customerPhone],
            'serverWebhook' => $checkout->webhookUrl,
            'enable3DS' => true,
        ]));
        $url = (string) ($session['sessionUrl'] ?? '');
        if (! str_starts_with($url, 'https://')) {
            throw new GatewayError((string) __('payments.gateways.refused', ['gateway' => $this->label()]), detail: 'no sessionUrl');
        }

        return new GatewaySession(isset($session['_id']) ? (string) $session['_id'] : null, $url);
    }

    public function status(StoreGatewayAccount $account, StoreOnlinePayment $payment): GatewayResult
    {
        if ($payment->external_id === null) {
            return new GatewayResult(GatewayResult::OPEN);
        }
        $data = (array) ($this->send(fn () => $this->client($account)->get('/v3/payment/sessions/'.rawurlencode((string) $payment->external_id).'/payment'))['data'] ?? []);
        $state = match (strtoupper((string) ($data['status'] ?? ''))) {
            'PAID' => GatewayResult::PAID,
            'PENDING' => GatewayResult::WAITING,
            'FAILED', 'REJECTED', 'VOIDED', 'REVERSED', 'REFUNDED' => GatewayResult::FAILED,
            'EXPIRED', 'ABANDONED' => GatewayResult::EXPIRED,
            default => GatewayResult::OPEN,
        };
        $amount = isset($data['amount']) && is_numeric($data['amount']) ? Money::toCents((string) $data['amount']) : null;
        $ref = $data['orderId'] ?? null;

        return new GatewayResult($state, $amount, is_string($ref) && $ref !== 'NA' ? $ref : null, isset($data['method']) ? (string) $data['method'] : null, $account->mode === 'live', (string) ($data['currency'] ?? 'EGP'));
    }

    public function webhook(StoreGatewayAccount $account, string $raw, array $headers, array $query): ?array
    {
        $body = json_decode($raw, true);
        $data = is_array($body) ? ($body['data'] ?? null) : null;
        $given = strtolower((string) ($headers['x-kashier-signature'] ?? ''));
        if (! is_array($data) || ! is_array($data['signatureKeys'] ?? null) || $given === '') {
            return null;
        }

        return hash_equals(self::signature($data, $account->credential('api_key')), $given)
            ? ['reference' => isset($data['merchantOrderId']) ? (string) $data['merchantOrderId'] : null]
            : null;
    }

    /** Kashier's webhook signature: the signatureKeys sorted, key=rawurlencode(value) joined by &, HMAC-SHA256. @param array<string, mixed> $data */
    public static function signature(array $data, string $apiKey): string
    {
        $keys = array_values(array_filter((array) $data['signatureKeys'], 'is_string'));
        sort($keys, SORT_STRING);
        $pairs = [];
        foreach ($keys as $key) {
            $value = $data[$key] ?? '';
            $pairs[] = $key.'='.rawurlencode(is_bool($value) ? ($value ? 'true' : 'false') : (string) (is_scalar($value) ? $value : ''));
        }

        return hash_hmac('sha256', implode('&', $pairs), $apiKey);
    }

    private function client(StoreGatewayAccount $account): PendingRequest
    {
        return $this->http($account->mode === 'live' ? self::LIVE : self::TEST)->withHeaders(['Authorization' => $account->credential('secret_key'), 'api-key' => $account->credential('api_key')]);
    }
}
