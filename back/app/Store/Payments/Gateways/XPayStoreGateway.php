<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Billing\Payments\XPay\HttpXPayClient;
use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;
use Illuminate\Support\Str;
use Throwable;

/**
 * XPay with the merchant's own account (docs.xpay.app): connecting registers our webhook on his account (the signing
 * secret comes back once and is kept encrypted), each order opens a hosted checkout session, and its result is read
 * back with GET /checkout/sessions/{id}. Test keys (sk_test_) run in XPay's test mode.
 */
final class XPayStoreGateway extends HttpGateway
{
    public const BASE = 'https://api.xpay.app';

    private const EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'];

    public function key(): string
    {
        return 'xpay';
    }

    public function label(): string
    {
        return 'X-Pay';
    }

    public function credentialFields(): array
    {
        return [['key' => 'secret_key', 'secret' => true]];
    }

    public function connect(array $credentials, string $webhookUrl): GatewayConnection
    {
        $key = trim($credentials['secret_key'] ?? '');
        if (preg_match('/^sk_(test|live)_[A-Za-z0-9]+$/', $key, $m) !== 1) {
            throw new GatewayError((string) __('payments.gateways.xpay.keys'), true);
        }
        // Registering our webhook checks the key too; the secret is shown only in this answer.
        $endpoint = $this->send(fn () => $this->http(self::BASE)->withToken($key)->post('/webhook-endpoints', [
            'url' => $webhookUrl, 'enabledEvents' => self::EVENTS, 'description' => 'Mksab store orders',
        ]));
        $secret = (string) ($endpoint['secret'] ?? '');
        if ($secret === '') {
            throw new GatewayError((string) __('payments.gateways.refused', ['gateway' => $this->label()]), detail: 'no webhook secret');
        }

        return new GatewayConnection(['secret_key' => $key, 'webhook_secret' => $secret, 'webhook_id' => (string) ($endpoint['id'] ?? '')], $m[1]);
    }

    public function disconnect(StoreGatewayAccount $account): void
    {
        $id = $account->credential('webhook_id');
        if ($id === '') {
            return;
        }
        try {
            $this->http(self::BASE)->withToken($account->credential('secret_key'))->delete('/webhook-endpoints/'.rawurlencode($id));
        } catch (Throwable) {
            // Best effort: a stale endpoint only gets refused signatures.
        }
    }

    public function checkout(StoreGatewayAccount $account, GatewayCheckout $checkout): GatewaySession
    {
        $session = $this->send(fn () => $this->http(self::BASE)->withToken($account->credential('secret_key'))
            ->withHeaders(['Idempotency-Key' => $checkout->reference.'-'.Str::lower(Str::random(8))])
            ->post('/checkout/sessions', [
                'afterCompletion' => ['type' => 'redirect', 'redirect' => ['url' => $checkout->returnUrl]],
                'cancelUrl' => $checkout->returnUrl,
                'lineItems' => [['priceData' => ['currency' => 'EGP', 'unitAmount' => $checkout->amountCents, 'productData' => ['name' => mb_substr($checkout->description, 0, 120)]], 'quantity' => 1]],
                'locale' => 'ar',
                'metadata' => ['reference' => $checkout->reference],
            ]));
        $url = (string) ($session['url'] ?? '');
        if (! str_starts_with($url, 'https://') || ! isset($session['id'])) {
            throw new GatewayError((string) __('payments.gateways.refused', ['gateway' => $this->label()]), detail: 'no session url');
        }

        return new GatewaySession((string) $session['id'], $url);
    }

    public function status(StoreGatewayAccount $account, StoreOnlinePayment $payment): GatewayResult
    {
        if ($payment->external_id === null || preg_match('/^cs_(test|live)_[A-Za-z0-9]+$/', $payment->external_id) !== 1) {
            return new GatewayResult(GatewayResult::OPEN);
        }
        $s = $this->send(fn () => $this->http(self::BASE)->withToken($account->credential('secret_key'))->get('/checkout/sessions/'.$payment->external_id));
        $status = (string) ($s['status'] ?? '');
        $paid = ($s['paymentStatus'] ?? null) === 'paid';
        $state = match (true) {
            $status === 'complete' && $paid => GatewayResult::PAID,
            $status === 'complete' => GatewayResult::WAITING,
            $status === 'expired' => GatewayResult::EXPIRED,
            default => GatewayResult::OPEN,
        };
        $ref = $s['paymentIntentId'] ?? ($s['paymentIntent']['id'] ?? null);

        // Before fees the merchant may pass to the customer.
        return new GatewayResult($state, isset($s['amountSubtotal']) ? (int) $s['amountSubtotal'] : (isset($s['amountTotal']) ? (int) $s['amountTotal'] : null), is_string($ref) ? $ref : null, null, (bool) ($s['livemode'] ?? false), (string) ($s['currency'] ?? 'EGP'));
    }

    public function webhook(StoreGatewayAccount $account, string $raw, array $headers, array $query): ?array
    {
        if (! HttpXPayClient::verify($raw, (string) ($headers['xpay-signature'] ?? ''), $account->credential('webhook_secret'))) {
            return null;
        }
        $event = json_decode($raw, true);
        $id = is_array($event) ? ($event['data']['object']['id'] ?? null) : null;

        return ['external_id' => is_string($id) ? $id : null];
    }
}
