<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;

/**
 * Paymob (Egypt, developers.paymob.com): an intention (POST /v1/intention/, `Token {secret key}`) opened on Paymob's
 * Unified Checkout; the transaction callback is signed with HMAC-SHA512 over Paymob's listed fields (the HMAC secret);
 * the result is read back by our reference (special_reference → merchant_order_id) through the transaction inquiry,
 * which needs an auth token from the API key. Integration IDs pick the methods (card, wallet, kiosk…).
 */
final class PaymobGateway extends HttpGateway
{
    public const BASE = 'https://accept.paymob.com';

    /** Unified Checkout for Egypt (developers.paymob.com «Unified Checkout (Redirection)»). */
    public const CHECKOUT = 'https://eg.checkout.paymob.com/';

    /** Paymob's transaction callback fields, in its order (dots = nested). */
    private const HMAC_FIELDS = [
        'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id', 'integration_id',
        'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment', 'is_voided', 'order.id', 'owner',
        'pending', 'source_data.pan', 'source_data.sub_type', 'source_data.type', 'success',
    ];

    public function key(): string
    {
        return 'paymob';
    }

    public function label(): string
    {
        return 'Paymob';
    }

    public function credentialFields(): array
    {
        return [
            ['key' => 'secret_key', 'secret' => true],
            ['key' => 'public_key', 'secret' => false],
            ['key' => 'api_key', 'secret' => true],
            ['key' => 'hmac_secret', 'secret' => true],
            ['key' => 'integration_ids', 'secret' => false],
        ];
    }

    public function connect(array $credentials, string $webhookUrl): GatewayConnection
    {
        $secret = trim($credentials['secret_key'] ?? '');
        $public = trim($credentials['public_key'] ?? '');
        if (preg_match('/^(egy_)?sk_(test|live)_\S+$/', $secret, $m) !== 1 || preg_match('/^(egy_)?pk_(test|live)_\S+$/', $public, $p) !== 1 || $m[2] !== $p[2]) {
            throw new GatewayError((string) __('payments.gateways.paymob.keys'), true);
        }
        if ($this->integrationIds($credentials['integration_ids'] ?? '') === []) {
            throw new GatewayError((string) __('payments.gateways.paymob.integrations'), true);
        }
        if (trim($credentials['hmac_secret'] ?? '') === '') {
            throw new GatewayError((string) __('payments.gateways.auth', ['gateway' => $this->label()]), true);
        }
        // The API key opens the transaction inquiry; a wrong one fails here, not on the first order.
        $this->token(trim($credentials['api_key'] ?? ''));

        return new GatewayConnection([
            'secret_key' => $secret, 'public_key' => $public, 'api_key' => trim($credentials['api_key'] ?? ''),
            'hmac_secret' => trim($credentials['hmac_secret'] ?? ''), 'integration_ids' => implode(',', $this->integrationIds($credentials['integration_ids'] ?? '')),
        ], $m[2]);
    }

    public function checkout(StoreGatewayAccount $account, GatewayCheckout $checkout): GatewaySession
    {
        [$first, $last] = self::names($checkout->customerName);
        $intention = $this->send(fn () => $this->http(self::BASE)->withHeaders(['Authorization' => 'Token '.$account->credential('secret_key')])->post('/v1/intention/', [
            'amount' => $checkout->amountCents,
            'currency' => 'EGP',
            'payment_methods' => $this->integrationIds($account->credential('integration_ids')),
            'items' => [['name' => mb_substr($checkout->description, 0, 50), 'amount' => $checkout->amountCents, 'quantity' => 1]],
            'billing_data' => [
                'first_name' => $first, 'last_name' => $last,
                'phone_number' => $checkout->customerPhone,
                'email' => $checkout->customerEmail ?: 'customer@example.com',
                'country' => 'EG', 'city' => $checkout->city ?: 'NA', 'street' => mb_substr($checkout->address ?: 'NA', 0, 100),
                'building' => 'NA', 'floor' => 'NA', 'apartment' => 'NA', 'state' => 'NA',
            ],
            'special_reference' => $checkout->reference,
            'notification_url' => $checkout->webhookUrl,
            'redirection_url' => $checkout->returnUrl,
        ]));
        $secret = (string) ($intention['client_secret'] ?? '');
        if ($secret === '') {
            throw new GatewayError((string) __('payments.gateways.refused', ['gateway' => $this->label()]), detail: 'no client_secret');
        }

        return new GatewaySession(isset($intention['id']) ? (string) $intention['id'] : null, self::CHECKOUT.'?'.http_build_query(['publicKey' => $account->credential('public_key'), 'clientSecret' => $secret]));
    }

    public function status(StoreGatewayAccount $account, StoreOnlinePayment $payment): GatewayResult
    {
        $token = $this->token($account->credential('api_key'));
        $response = $this->http(self::BASE)->withToken($token)->post('/api/ecommerce/orders/transaction_inquiry', ['auth_token' => $token, 'merchant_order_id' => $payment->reference]);
        // No transaction for this reference yet: the customer hasn't paid (or hasn't tried).
        if ($response->status() === 404 || ($response->status() === 400 && str_contains(mb_strtolower($response->body()), 'not found'))) {
            return new GatewayResult(GatewayResult::OPEN);
        }
        $tx = $this->send(fn () => $response);

        return self::result($tx);
    }

    public function webhook(StoreGatewayAccount $account, string $raw, array $headers, array $query): ?array
    {
        $body = json_decode($raw, true);
        $obj = is_array($body) ? ($body['obj'] ?? null) : null;
        $given = (string) ($query['hmac'] ?? '');
        if (! is_array($obj) || $given === '' || ($body['type'] ?? 'TRANSACTION') !== 'TRANSACTION') {
            return null;
        }
        $expected = hash_hmac('sha512', self::hmacString($obj), $account->credential('hmac_secret'));

        return hash_equals($expected, strtolower($given))
            ? ['reference' => isset($obj['order']['merchant_order_id']) ? (string) $obj['order']['merchant_order_id'] : null]
            : null;
    }

    /** The concatenated values Paymob signs (booleans as true / false). @param array<string, mixed> $obj */
    public static function hmacString(array $obj): string
    {
        $out = '';
        foreach (self::HMAC_FIELDS as $path) {
            $value = $obj;
            foreach (explode('.', $path) as $key) {
                $value = is_array($value) ? ($value[$key] ?? '') : '';
            }
            $out .= is_bool($value) ? ($value ? 'true' : 'false') : (string) (is_scalar($value) ? $value : '');
        }

        return $out;
    }

    /** @param array<string, mixed> $tx */
    private static function result(array $tx): GatewayResult
    {
        $success = ($tx['success'] ?? false) === true;
        $pending = ($tx['pending'] ?? false) === true;
        $undone = ($tx['is_voided'] ?? false) === true || ($tx['is_refunded'] ?? false) === true;
        $state = match (true) {
            $success && ! $pending && ! $undone => GatewayResult::PAID,
            $pending => GatewayResult::WAITING,
            default => GatewayResult::FAILED,
        };

        return new GatewayResult(
            $state,
            isset($tx['amount_cents']) ? (int) $tx['amount_cents'] : null,
            isset($tx['id']) ? (string) $tx['id'] : null,
            isset($tx['source_data']['type']) ? (string) $tx['source_data']['type'] : null,
            isset($tx['is_live']) ? (bool) $tx['is_live'] : null,
            (string) ($tx['currency'] ?? 'EGP'),
        );
    }

    /** @throws GatewayError */
    private function token(string $apiKey): string
    {
        if ($apiKey === '') {
            throw new GatewayError((string) __('payments.gateways.auth', ['gateway' => $this->label()]), true);
        }
        $data = $this->send(fn () => $this->http(self::BASE)->post('/api/auth/tokens', ['api_key' => $apiKey]));
        $token = (string) ($data['token'] ?? '');

        return $token !== '' ? $token : throw new GatewayError((string) __('payments.gateways.auth', ['gateway' => $this->label()]), true);
    }

    /** "4900123, 4900124" → [4900123, 4900124]. @return list<int> */
    private function integrationIds(string $raw): array
    {
        return array_values(array_unique(array_map('intval', array_filter(preg_split('/[\s,،]+/u', $raw) ?: [], fn ($v) => ctype_digit((string) $v) && (int) $v > 0))));
    }
}
