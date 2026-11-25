<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use App\Billing\Payments\XPay\HttpXPayClient;
use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Str;
use Throwable;

/**
 * Stripe with the merchant's own account (docs.stripe.com): connecting registers our webhook endpoint on his account (the
 * whsec_ signing secret comes back and is kept encrypted), each order opens a Checkout Session (mode payment, EGP,
 * form-encoded API), its result is read back with GET /v1/checkout/sessions/{id}, and refunds go through /v1/refunds.
 * Stripe-Signature uses the same "t=…,v1=…" HMAC-SHA256 scheme as XPay.
 */
final class StripeGateway extends HttpGateway
{
    public const BASE = 'https://api.stripe.com';

    private const EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'];

    public function key(): string
    {
        return 'stripe';
    }

    public function label(): string
    {
        return 'Stripe';
    }

    public function credentialFields(): array
    {
        return [['key' => 'secret_key', 'secret' => true]];
    }

    public function connect(array $credentials, string $webhookUrl): GatewayConnection
    {
        $key = trim($credentials['secret_key'] ?? '');
        if (preg_match('/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/', $key, $m) !== 1) {
            throw new GatewayError((string) __('payments.gateways.stripe.keys'), true);
        }
        $endpoint = $this->send(fn () => $this->stripe($key)->post('/v1/webhook_endpoints', [
            'url' => $webhookUrl, 'enabled_events' => self::EVENTS, 'description' => 'Mksab store orders',
        ]));
        $secret = (string) ($endpoint['secret'] ?? '');
        if ($secret === '') {
            throw new GatewayError((string) __('payments.gateways.refused', ['gateway' => $this->label()]), detail: 'no webhook secret');
        }

        return new GatewayConnection(['secret_key' => $key, 'webhook_secret' => $secret, 'webhook_id' => (string) ($endpoint['id'] ?? '')], $m[2]);
    }

    public function disconnect(StoreGatewayAccount $account): void
    {
        $id = $account->credential('webhook_id');
        if ($id === '') {
            return;
        }
        try {
            $this->stripe($account->credential('secret_key'))->delete('/v1/webhook_endpoints/'.rawurlencode($id));
        } catch (Throwable) {
            // Best effort: a stale endpoint only gets refused signatures.
        }
    }

    public function checkout(StoreGatewayAccount $account, GatewayCheckout $checkout): GatewaySession
    {
        $session = $this->send(fn () => $this->stripe($account->credential('secret_key'))
            ->withHeaders(['Idempotency-Key' => $checkout->reference.'-'.Str::lower(Str::random(8))])
            ->post('/v1/checkout/sessions', array_filter([
                'mode' => 'payment',
                'success_url' => $checkout->returnUrl,
                'cancel_url' => $checkout->returnUrl,
                'client_reference_id' => $checkout->reference,
                'customer_email' => $checkout->customerEmail,
                'line_items' => [['quantity' => 1, 'price_data' => ['currency' => 'egp', 'unit_amount' => $checkout->amountCents, 'product_data' => ['name' => mb_substr($checkout->description, 0, 120)]]]],
                'metadata' => ['reference' => $checkout->reference],
                'payment_intent_data' => ['metadata' => ['reference' => $checkout->reference]],
                'locale' => 'auto',
            ], fn ($v) => $v !== null && $v !== '')));
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
        $s = $this->send(fn () => $this->stripe($account->credential('secret_key'))->get('/v1/checkout/sessions/'.$payment->external_id));
        $status = (string) ($s['status'] ?? '');
        $state = match (true) {
            $status === 'complete' && ($s['payment_status'] ?? null) === 'paid' => GatewayResult::PAID,
            $status === 'complete' => GatewayResult::WAITING,
            $status === 'expired' => GatewayResult::EXPIRED,
            default => GatewayResult::OPEN,
        };
        $intent = $s['payment_intent'] ?? null;

        return new GatewayResult(
            $state,
            isset($s['amount_subtotal']) ? (int) $s['amount_subtotal'] : (isset($s['amount_total']) ? (int) $s['amount_total'] : null),
            is_string($intent) ? $intent : (is_array($intent) && isset($intent['id']) ? (string) $intent['id'] : null),
            'card',
            (bool) ($s['livemode'] ?? false),
            strtoupper((string) ($s['currency'] ?? 'egp')),
        );
    }

    public function refund(StoreGatewayAccount $account, StoreOnlinePayment $payment, int $amountCents, ?string $reason): GatewayRefund
    {
        if ($payment->payment_ref === null || ! str_starts_with($payment->payment_ref, 'pi_')) {
            throw new GatewayError((string) __('payments.gateways.refund_unavailable', ['gateway' => $this->label()]));
        }
        $refund = $this->send(fn () => $this->stripe($account->credential('secret_key'))
            ->withHeaders(['Idempotency-Key' => 'refund-'.$payment->reference.'-'.Str::lower(Str::random(8))])
            ->post('/v1/refunds', ['payment_intent' => $payment->payment_ref, 'amount' => $amountCents, 'reason' => 'requested_by_customer', 'metadata' => ['reason' => mb_substr((string) $reason, 0, 300)]]));

        $result = GatewayRefund::from((string) ($refund['status'] ?? ''), isset($refund['id']) ? (string) $refund['id'] : null, ['succeeded'], ['pending', 'requires_action']);
        if ($result->state === GatewayRefund::FAILED) {
            throw new GatewayError((string) __('payments.gateways.refund_refused', ['gateway' => $this->label(), 'reason' => (string) ($refund['failure_reason'] ?? '—')]));
        }

        return $result;
    }

    public function webhook(StoreGatewayAccount $account, string $raw, array $headers, array $query): ?array
    {
        if (! HttpXPayClient::verify($raw, (string) ($headers['stripe-signature'] ?? ''), $account->credential('webhook_secret'))) {
            return null;
        }
        $event = json_decode($raw, true);
        $id = is_array($event) ? ($event['data']['object']['id'] ?? null) : null;

        return ['external_id' => is_string($id) ? $id : null];
    }

    /** Stripe takes form-encoded bodies (nested arrays as a[b][c]) with the secret key as Bearer. */
    private function stripe(string $key): PendingRequest
    {
        return $this->http(self::BASE)->withToken($key)->asForm();
    }
}
