<?php

declare(strict_types=1);

use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;
use App\Store\Payments\Gateways\GatewayCheckout;
use App\Store\Payments\Gateways\GatewayError;
use App\Store\Payments\Gateways\GatewayResult;
use App\Store\Payments\Gateways\KashierGateway;
use App\Store\Payments\Gateways\PaymobGateway;
use App\Store\Payments\Gateways\StripeGateway;
use App\Store\Payments\Gateways\XPayStoreGateway;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;

function drvAccount(string $gateway, array $credentials, string $mode = 'test'): StoreGatewayAccount
{
    return (new StoreGatewayAccount)->forceFill(['gateway' => $gateway, 'credentials' => $credentials, 'mode' => $mode, 'status' => 'active', 'webhook_token' => str_repeat('a', 40)]);
}

function drvPayment(string $reference = 'MK1O1001XABCDEF', ?string $external = null): StoreOnlinePayment
{
    return (new StoreOnlinePayment)->forceFill(['reference' => $reference, 'external_id' => $external, 'amount' => '550.00', 'status' => 'open']);
}

function drvCheckout(): GatewayCheckout
{
    return new GatewayCheckout('MK1O1001XABCDEF', 55000, 'طلب رقم 1001 من متجر حبة', 'سارة محمد علي', '+201012345678', 'sara@example.com', 'https://shop.test/pay/abc?ref=MK1O1001XABCDEF', 'https://app.test/api/webhooks/payments/x/'.str_repeat('a', 40), 'القاهرة', 'شارع 9');
}

// --- Paymob -----------------------------------------------------------------------------

it('connects Paymob only with matching keys, integration ids and a working API key', function () {
    Http::fake(['accept.paymob.com/api/auth/tokens' => Http::sequence()->push(['token' => 'tok'])->push([], 401)]);
    $paymob = app(PaymobGateway::class);
    $good = ['secret_key' => 'egy_sk_test_abc', 'public_key' => 'egy_pk_test_abc', 'api_key' => 'api', 'hmac_secret' => 'h', 'integration_ids' => '4900123, 4900124'];

    $c = $paymob->connect($good, 'https://hook');
    expect($c->mode)->toBe('test')->and($c->credentials['integration_ids'])->toBe('4900123,4900124');
    expect(fn () => $paymob->connect(['public_key' => 'egy_pk_live_x'] + $good, 'https://hook'))->toThrow(GatewayError::class);
    expect(fn () => $paymob->connect(['integration_ids' => 'card'] + $good, 'https://hook'))->toThrow(GatewayError::class);
    expect(fn () => $paymob->connect($good, 'https://hook'))->toThrow(fn (GatewayError $e) => expect($e->auth)->toBeTrue());
});

it('opens a Paymob intention on the Unified Checkout and reads it back by our reference', function () {
    Http::fake([
        'accept.paymob.com/v1/intention/' => Http::response(['id' => 'pi_1', 'client_secret' => 'cs_x']),
        'accept.paymob.com/api/auth/tokens' => Http::response(['token' => 'tok']),
        'accept.paymob.com/api/ecommerce/orders/transaction_inquiry' => Http::response(['id' => 99, 'success' => true, 'pending' => false, 'is_voided' => false, 'is_refunded' => false, 'amount_cents' => 55000, 'currency' => 'EGP', 'source_data' => ['type' => 'card']]),
    ]);
    $account = drvAccount('paymob', ['secret_key' => 'egy_sk_test_abc', 'public_key' => 'egy_pk_test_abc', 'api_key' => 'api', 'hmac_secret' => 'h', 'integration_ids' => '4900123']);
    $paymob = app(PaymobGateway::class);

    $session = $paymob->checkout($account, drvCheckout());
    expect($session->url)->toBe('https://eg.checkout.paymob.com/?publicKey=egy_pk_test_abc&clientSecret=cs_x');
    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/v1/intention/') && $r->hasHeader('Authorization', 'Token egy_sk_test_abc')
        && $r['amount'] === 55000 && $r['payment_methods'] === [4900123] && $r['special_reference'] === 'MK1O1001XABCDEF'
        && $r['billing_data']['first_name'] === 'سارة' && $r['billing_data']['last_name'] === 'محمد علي' && str_contains($r['notification_url'], '/webhooks/payments/'));

    $result = $paymob->status($account, drvPayment());
    expect($result->state)->toBe(GatewayResult::PAID)->and($result->amountCents)->toBe(55000)->and($result->paymentRef)->toBe('99');
});

it('checks Paymob\'s HMAC on the transaction callback', function () {
    $account = drvAccount('paymob', ['hmac_secret' => 'secret']);
    $obj = ['amount_cents' => 55000, 'created_at' => '2026-11-25T10:00:00', 'currency' => 'EGP', 'error_occured' => false, 'has_parent_transaction' => false, 'id' => 99, 'integration_id' => 4900123, 'is_3d_secure' => true, 'is_auth' => false, 'is_capture' => false, 'is_refunded' => false, 'is_standalone_payment' => true, 'is_voided' => false, 'order' => ['id' => 7, 'merchant_order_id' => 'MK1O1001XABCDEF'], 'owner' => 5, 'pending' => false, 'source_data' => ['pan' => '2346', 'sub_type' => 'MasterCard', 'type' => 'card'], 'success' => true];
    $raw = json_encode(['type' => 'TRANSACTION', 'obj' => $obj]);
    $hmac = hash_hmac('sha512', '550002026-11-25T10:00:00EGPfalsefalse994900123truefalsefalsefalsetruefalse75false2346MasterCardcardtrue', 'secret');

    expect(PaymobGateway::hmacString($obj))->toBe('550002026-11-25T10:00:00EGPfalsefalse994900123truefalsefalsefalsetruefalse75false2346MasterCardcardtrue')
        ->and(app(PaymobGateway::class)->webhook($account, $raw, [], ['hmac' => $hmac]))->toBe(['reference' => 'MK1O1001XABCDEF'])
        ->and(app(PaymobGateway::class)->webhook($account, $raw, [], ['hmac' => str_repeat('0', 128)]))->toBeNull()
        ->and(app(PaymobGateway::class)->webhook($account, $raw, [], []))->toBeNull();
});

// --- Kashier ----------------------------------------------------------------------------

it('connects Kashier on the test host and opens a payment session', function () {
    Http::fake([
        'test-api.kashier.io/v3/payment/sessions?limit=1' => Http::response(['data' => []]),
        'test-api.kashier.io/v3/payment/sessions' => Http::response(['_id' => 'ses_1', 'sessionUrl' => 'https://payments.kashier.io/session/ses_1', 'status' => 'CREATED']),
        'test-api.kashier.io/v3/payment/sessions/ses_1/payment' => Http::response(['data' => ['status' => 'PAID', 'amount' => '550.00', 'currency' => 'EGP', 'method' => 'card', 'orderId' => 'K-1']]),
    ]);
    $kashier = app(KashierGateway::class);
    $c = $kashier->connect(['merchant_id' => 'mid-123-456', 'api_key' => 'pk', 'secret_key' => 'ksk_test_x'], 'https://hook');
    expect($c->mode)->toBe('test')->and($c->credentials['merchant_id'])->toBe('MID-123-456');
    expect(fn () => $kashier->connect(['merchant_id' => '123', 'api_key' => 'pk', 'secret_key' => 'ksk_test_x'], 'https://hook'))->toThrow(GatewayError::class);

    $account = drvAccount('kashier', $c->credentials);
    $session = $kashier->checkout($account, drvCheckout());
    expect($session->url)->toBe('https://payments.kashier.io/session/ses_1')->and($session->externalId)->toBe('ses_1');
    Http::assertSent(fn (HttpRequest $r) => $r->url() === 'https://test-api.kashier.io/v3/payment/sessions' && $r->method() === 'POST' && $r->hasHeader('Authorization', 'ksk_test_x') && $r->hasHeader('api-key', 'pk')
        && $r['amount'] === '550.00' && $r['order'] === 'MK1O1001XABCDEF' && $r['merchantId'] === 'MID-123-456' && str_contains($r['serverWebhook'], '/webhooks/payments/'));

    $result = $kashier->status($account, drvPayment(external: 'ses_1'));
    expect($result->state)->toBe(GatewayResult::PAID)->and($result->amountCents)->toBe(55000);
});

it('checks Kashier\'s webhook signature like its documentation\'s worked example', function () {
    $data = ['amount' => 1, 'channel' => 'online | e-commerce', 'currency' => 'EGP', 'kashierOrderId' => '9ad06b17-755b-4e21-9774-aff3e2726ac9', 'merchantOrderId' => '1653481557813', 'method' => 'card', 'orderReference' => 'TEST-ORD-38855', 'status' => 'SUCCESS', 'transactionId' => 'TX-249893963', 'transactionResponseCode' => '00', 'signatureKeys' => ['amount', 'channel', 'currency', 'kashierOrderId', 'merchantOrderId', 'method', 'orderReference', 'status', 'transactionId', 'transactionResponseCode']];

    expect(KashierGateway::signature($data, '11111'))->toBe('9610477b2255b2a8ef84fd89adfaa5f1305ff9c20324205851890f1ea03109f4');
    $account = drvAccount('kashier', ['api_key' => '11111']);
    $raw = json_encode(['event' => 'pay', 'data' => $data]);
    expect(app(KashierGateway::class)->webhook($account, $raw, ['x-kashier-signature' => '9610477b2255b2a8ef84fd89adfaa5f1305ff9c20324205851890f1ea03109f4'], []))->toBe(['reference' => '1653481557813'])
        ->and(app(KashierGateway::class)->webhook($account, $raw, ['x-kashier-signature' => 'nope'], []))->toBeNull();
});

// --- XPay -------------------------------------------------------------------------------

it('connects XPay by registering our webhook on the merchant\'s account', function () {
    Http::fake([
        'api.xpay.app/webhook-endpoints' => Http::response(['id' => 'we_1', 'secret' => 'whsec_abc']),
        'api.xpay.app/checkout/sessions' => Http::response(['id' => 'cs_test_Abc123', 'url' => 'https://checkout.xpay.app/c/cs_test_Abc123']),
        'api.xpay.app/checkout/sessions/cs_test_Abc123' => Http::response(['id' => 'cs_test_Abc123', 'status' => 'complete', 'paymentStatus' => 'unpaid', 'amountSubtotal' => 55000]),
    ]);
    $xpay = app(XPayStoreGateway::class);
    expect(fn () => $xpay->connect(['secret_key' => 'pk_test_x'], 'https://hook'))->toThrow(GatewayError::class);

    $c = $xpay->connect(['secret_key' => 'sk_test_abc'], 'https://app.test/api/webhooks/payments/xpay/'.str_repeat('a', 40));
    expect($c->credentials)->toMatchArray(['webhook_secret' => 'whsec_abc', 'webhook_id' => 'we_1'])->and($c->mode)->toBe('test');
    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/webhook-endpoints') && $r->hasHeader('Authorization', 'Bearer sk_test_abc') && in_array('checkout.session.async_payment_succeeded', $r['enabledEvents'], true));

    $account = drvAccount('xpay', $c->credentials);
    expect($xpay->checkout($account, drvCheckout())->externalId)->toBe('cs_test_Abc123')
        // Fawry: checkout done, money not in yet.
        ->and($xpay->status($account, drvPayment(external: 'cs_test_Abc123'))->state)->toBe(GatewayResult::WAITING);

    $raw = '{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_Abc123"}}}';
    $t = (string) time();
    expect($xpay->webhook($account, $raw, ['xpay-signature' => 't='.$t.',v1='.hash_hmac('sha256', $t.'.'.$raw, 'whsec_abc')], []))->toBe(['external_id' => 'cs_test_Abc123'])
        ->and($xpay->webhook($account, $raw, ['xpay-signature' => 't='.$t.',v1=bad'], []))->toBeNull();
});

// --- Stripe -----------------------------------------------------------------------------

it('connects Stripe by registering our webhook, opens a Checkout Session in EGP and refunds through it', function () {
    Http::fake([
        'api.stripe.com/v1/webhook_endpoints' => Http::response(['id' => 'we_1', 'secret' => 'whsec_s']),
        'api.stripe.com/v1/checkout/sessions' => Http::response(['id' => 'cs_test_S1', 'url' => 'https://checkout.stripe.com/c/pay/cs_test_S1']),
        'api.stripe.com/v1/checkout/sessions/cs_test_S1' => Http::response(['id' => 'cs_test_S1', 'status' => 'complete', 'payment_status' => 'paid', 'amount_subtotal' => 55000, 'currency' => 'egp', 'payment_intent' => 'pi_1', 'livemode' => false]),
        'api.stripe.com/v1/refunds' => Http::response(['id' => 're_1', 'status' => 'succeeded']),
    ]);
    $stripe = app(StripeGateway::class);
    expect(fn () => $stripe->connect(['secret_key' => 'pk_test_x'], 'https://hook'))->toThrow(GatewayError::class);

    $c = $stripe->connect(['secret_key' => 'sk_test_abc'], 'https://hook');
    expect($c->credentials)->toMatchArray(['webhook_secret' => 'whsec_s', 'webhook_id' => 'we_1'])->and($c->mode)->toBe('test');
    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/v1/webhook_endpoints') && $r->hasHeader('Authorization', 'Bearer sk_test_abc') && $r->isForm());

    $account = drvAccount('stripe', $c->credentials);
    expect($stripe->checkout($account, drvCheckout())->url)->toBe('https://checkout.stripe.com/c/pay/cs_test_S1');
    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/v1/checkout/sessions') && $r['mode'] === 'payment' && $r['line_items'][0]['price_data']['currency'] === 'egp'
        && (int) $r['line_items'][0]['price_data']['unit_amount'] === 55000 && $r['client_reference_id'] === 'MK1O1001XABCDEF');

    $payment = drvPayment(external: 'cs_test_S1');
    $result = $stripe->status($account, $payment);
    expect($result->state)->toBe(GatewayResult::PAID)->and($result->paymentRef)->toBe('pi_1')->and($result->currency)->toBe('EGP');

    $payment->payment_ref = 'pi_1';
    expect($stripe->refund($account, $payment, 10000, 'مقاس غلط')->reference)->toBe('re_1');
    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/v1/refunds') && $r['payment_intent'] === 'pi_1' && (int) $r['amount'] === 10000);

    $raw = '{"type":"checkout.session.completed","data":{"object":{"id":"cs_test_S1"}}}';
    $t = (string) time();
    expect($stripe->webhook($account, $raw, ['stripe-signature' => 't='.$t.',v1='.hash_hmac('sha256', $t.'.'.$raw, 'whsec_s')], []))->toBe(['external_id' => 'cs_test_S1']);
});

it('refunds through Paymob, Kashier and XPay with their own calls', function () {
    Http::fake([
        'accept.paymob.com/api/acceptance/void_refund/refund' => Http::response(['id' => 777, 'success' => true, 'pending' => false]),
        'test-api.kashier.io/v3/payment/refund/K-ORDER-1' => Http::response(['status' => 'SUCCESS', 'transactionId' => 'TX-R1']),
        'api.xpay.app/refunds' => Http::response(['id' => 'rf_1', 'status' => 'PENDING']),
    ]);
    $p = drvPayment();

    $p->payment_ref = '99';
    expect(app(PaymobGateway::class)->refund(drvAccount('paymob', ['secret_key' => 'egy_sk_test_a']), $p, 5000, null)->reference)->toBe('777');
    Http::assertSent(fn (HttpRequest $r) => str_ends_with($r->url(), '/void_refund/refund') && $r['transaction_id'] === 99 && $r['amount_cents'] === 5000 && $r->hasHeader('Authorization', 'Token egy_sk_test_a'));

    $p->payment_ref = 'K-ORDER-1';
    expect(app(KashierGateway::class)->refund(drvAccount('kashier', ['secret_key' => 'ksk_test_k']), $p, 5000, 'x')->reference)->toBe('TX-R1');
    Http::assertSent(fn (HttpRequest $r) => $r->method() === 'PUT' && str_ends_with($r->url(), '/v3/payment/refund/K-ORDER-1') && $r['apiOperation'] === 'REFUND' && (float) $r['transaction']['amount'] === 50.0);

    $p->payment_ref = 'pi_x';
    expect(app(XPayStoreGateway::class)->refund(drvAccount('xpay', ['secret_key' => 'sk_test_x']), $p, 5000, null)->state)->toBe('pending');

    // A kiosk payment has no transaction to refund through the API.
    $p->payment_ref = null;
    expect(fn () => app(PaymobGateway::class)->refund(drvAccount('paymob', []), $p, 5000, null))->toThrow(GatewayError::class);
});
