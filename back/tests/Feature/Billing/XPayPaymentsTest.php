<?php

declare(strict_types=1);

use App\Billing\Payments\XPay\FakeXPayClient;
use App\Billing\Payments\XPay\HttpXPayClient;
use App\Billing\Payments\XPay\XPayClient;
use App\Enums\PaymentStatus;
use App\Models\Invoice;
use App\Models\OnlinePayment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Storage::fake('local');
    PaymentMethod::query()->whereKey('xpay')->update(['is_active' => true]);
    PaymentMethod::query()->whereKey('instapay')->update(['is_active' => true, 'account_value' => 'platform@instapay']);
    $this->owner = xpOwner();
});

function xpOwner(): User
{
    $user = User::factory()->for(Tenant::factory()->onPlan('basic')->create())->create();
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function xpFake(): FakeXPayClient
{
    /** @var FakeXPayClient $fake */
    $fake = app(XPayClient::class);

    return $fake;
}

/** «ادفع أونلاين» for a Pro month: the invoice is created and XPay's page comes back. */
function xpBuy(): TestResponse
{
    return test()->postJson('/api/v1/dashboard/billing/checkout', ['type' => 'subscription', 'plan_key' => 'pro', 'period' => 'monthly', 'method' => 'xpay']);
}

/** XPay's webhook for a session (signed like XPay does unless told otherwise). */
function xpHook(string $sessionId, string $type = 'checkout.session.completed', ?string $signature = null): TestResponse
{
    $raw = json_encode(['id' => 'evt_test_1', 'type' => $type, 'data' => ['object' => ['id' => $sessionId, 'object' => 'checkout.session']]]);

    return test()->call('POST', '/api/v1/webhooks/xpay', [], [], [], test()->transformHeadersToServerVars(internalHeaders() + [
        'Content-Type' => 'application/json',
        'XPay-Signature' => $signature ?? FakeXPayClient::sign($raw),
    ]), $raw);
}

function xpSession(int $invoiceId): string
{
    return (string) OnlinePayment::query()->withoutGlobalScopes()->where('invoice_id', $invoiceId)->latest('id')->value('external_id');
}

it('offers the online method only while it is on and XPay is configured', function () {
    $preview = fn () => $this->postJson('/api/v1/dashboard/billing/checkout/preview', ['type' => 'subscription', 'plan_key' => 'pro', 'period' => 'monthly'])->assertOk()->json('data.pay_with');

    expect(collect($preview())->firstWhere('key', 'xpay'))->toMatchArray(['kind' => 'xpay', 'type' => 'online']);

    xpFake()->ready = false;
    expect(collect($preview())->pluck('key')->all())->toBe(['instapay']);

    xpFake()->ready = true;
    PaymentMethod::query()->whereKey('xpay')->update(['is_active' => false]);
    expect(collect($preview())->pluck('key')->all())->toBe(['instapay']);
    xpBuy()->assertStatus(422)->assertJsonValidationErrors('method');
});

it('opens an XPay session for the invoice total without a receipt', function () {
    $data = xpBuy()->assertCreated()->json('data');

    expect($data['redirect_url'])->toStartWith('https://checkout.xpay.app/c/cs_test_')
        ->and($data['status'])->toBe('open')
        ->and($data['payments'])->toBe([]);
    $sent = xpFake()->created[0];
    $invoice = Invoice::query()->withoutGlobalScopes()->findOrFail($data['id']);
    expect($sent['body']['lineItems'][0]['priceData'])->toMatchArray(['currency' => 'EGP', 'unitAmount' => $invoice->totalCents()])
        ->and($sent['body']['metadata'])->toMatchArray(['invoice_id' => (string) $invoice->id, 'tenant_id' => (string) $this->owner->tenant_id])
        ->and($sent['body']['afterCompletion']['redirect']['url'])->toEndWith('/dashboard/settings/billing/invoices/'.$invoice->id.'?session={CHECKOUT_SESSION_ID}')
        ->and($sent['key'])->toStartWith('invoice-'.$invoice->id.'-')
        ->and(OnlinePayment::query()->withoutGlobalScopes()->where('invoice_id', $invoice->id)->value('status'))->toBe('open');
});

it('activates the invoice once when XPay confirms the payment, from XPay itself', function () {
    $id = xpBuy()->json('data.id');
    $session = xpSession($id);

    // Not paid yet: the webhook changes nothing.
    xpHook($session)->assertOk();
    expect(Invoice::query()->withoutGlobalScopes()->find($id)->status->value)->toBe('open');

    xpFake()->pay($session);
    xpHook($session)->assertOk();
    xpHook($session)->assertOk();

    $invoice = Invoice::query()->withoutGlobalScopes()->find($id);
    expect($invoice->status->value)->toBe('paid')
        ->and($this->owner->tenant->fresh()->plan_key)->toBe('pro')
        ->and(Payment::query()->withoutGlobalScopes()->where('invoice_id', $id)->count())->toBe(1)
        ->and(Payment::query()->withoutGlobalScopes()->where('invoice_id', $id)->value('status'))->toBe(PaymentStatus::Approved)
        ->and(UserNotification::query()->withoutGlobalScopes()->where('title', __('notifications.online_paid.title'))->count())->toBe(1);
    $this->getJson("/api/v1/dashboard/billing/invoices/{$id}")->assertJsonPath('data.payments.0.has_receipt', false)->assertJsonPath('data.payments.0.method.key', 'xpay');
});

it('lists an invoice started online, and one waiting for its Fawry payment', function () {
    $id = xpBuy()->json('data.id');
    $this->getJson('/api/v1/dashboard/billing/invoices')->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.online', 'open');

    xpFake()->pay(xpSession($id), later: true);
    xpHook(xpSession($id))->assertOk();
    $this->getJson('/api/v1/dashboard/billing/invoices')->assertJsonPath('data.0.online', 'waiting');
    $this->getJson("/api/v1/dashboard/billing/invoices/{$id}")->assertJsonPath('data.online', 'waiting');
});

it('refuses webhooks XPay did not sign, or old ones', function () {
    $id = xpBuy()->json('data.id');
    $session = xpSession($id);
    xpFake()->pay($session);

    xpHook($session, signature: 't='.time().',v1=forged')->assertForbidden();
    $raw = json_encode(['type' => 'checkout.session.completed', 'data' => ['object' => ['id' => $session]]]);
    xpHook($session, signature: FakeXPayClient::sign($raw, time() - 600))->assertForbidden();
    expect(Invoice::query()->withoutGlobalScopes()->find($id)->status->value)->toBe('open');

    // Signed, but a session we never opened: ignored.
    xpHook('cs_test_SomeoneElse123456')->assertOk();
});

it('waits for a Fawry payment and activates when the money arrives', function () {
    $id = xpBuy()->json('data.id');
    $session = xpSession($id);

    xpFake()->pay($session, later: true);
    xpHook($session)->assertOk();
    expect(OnlinePayment::query()->withoutGlobalScopes()->where('external_id', $session)->value('status'))->toBe('waiting')
        ->and(Invoice::query()->withoutGlobalScopes()->find($id)->status->value)->toBe('open');
    $this->postJson("/api/v1/dashboard/billing/invoices/{$id}/online", ['session' => $session])->assertOk()->assertJsonPath('data.online_status', 'waiting');

    xpFake()->pay($session);
    xpHook($session, 'checkout.session.async_payment_succeeded')->assertOk();
    expect(Invoice::query()->withoutGlobalScopes()->find($id)->status->value)->toBe('paid');
});

it('settles the session when the merchant comes back, only for his own invoice', function () {
    $id = xpBuy()->json('data.id');
    $session = xpSession($id);
    xpFake()->pay($session);

    $this->postJson("/api/v1/dashboard/billing/invoices/{$id}/online", ['session' => 'nope'])->assertStatus(422);
    $this->postJson("/api/v1/dashboard/billing/invoices/{$id}/online", ['session' => $session])->assertOk()
        ->assertJsonPath('data.online_status', 'paid')->assertJsonPath('data.status', 'paid');

    // Another store: its own invoice id can't be used, and the session isn't its own.
    $other = xpOwner();
    $this->postJson("/api/v1/dashboard/billing/invoices/{$id}/online", ['session' => $session])->assertNotFound();
    $otherId = xpBuy()->json('data.id');
    $this->postJson("/api/v1/dashboard/billing/invoices/{$otherId}/online", ['session' => $session])->assertOk()->assertJsonPath('data.online_status', 'unknown')->assertJsonPath('data.status', 'open');
    expect($other->tenant->fresh()->plan_key)->toBe('basic');

    app('auth')->forgetGuards();
    $this->postJson("/api/v1/dashboard/billing/invoices/{$id}/online", ['session' => $session])->assertUnauthorized();
});

it('never activates on a smaller amount than the invoice', function () {
    $id = xpBuy()->json('data.id');
    $session = xpSession($id);
    xpFake()->pay($session);
    xpFake()->sessions[$session]['amountSubtotal'] = 100;
    xpFake()->sessions[$session]['amountTotal'] = 100;

    xpHook($session)->assertOk();
    expect(OnlinePayment::query()->withoutGlobalScopes()->where('external_id', $session)->value('status'))->toBe('failed')
        ->and(Invoice::query()->withoutGlobalScopes()->find($id)->status->value)->toBe('open');
});

it('pays an open invoice online again, and keeps the receipt rules for transfers', function () {
    $id = xpBuy()->json('data.id');

    $this->postJson("/api/v1/dashboard/billing/invoices/{$id}/payments", ['method' => 'xpay'])->assertOk()->assertJsonPath('data.redirect_url', fn ($url) => str_starts_with($url, 'https://checkout.xpay.app/c/'));
    expect(OnlinePayment::query()->withoutGlobalScopes()->where('invoice_id', $id)->count())->toBe(2);
    $this->postJson("/api/v1/dashboard/billing/invoices/{$id}/payments", ['method' => 'instapay'])->assertStatus(422)->assertJsonValidationErrors(['sender_ref', 'receipt']);
});

it('says so when XPay is down, and the invoice stays payable', function () {
    xpFake()->fail = 'XPay 500: boom';

    xpBuy()->assertStatus(502)->assertJsonPath('code', 'gateway_unavailable');
    $invoice = Invoice::query()->withoutGlobalScopes()->where('tenant_id', $this->owner->tenant_id)->latest('id')->first();
    expect($invoice?->status->value)->toBe('open');
});

it('lets the admin turn the online method on without an account', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $rows = collect($this->getJson('/api/v1/admin/payment-methods')->assertOk()->json('data'));
    expect($rows->firstWhere('key', 'xpay'))->toMatchArray(['kind' => 'xpay', 'needs_account' => false, 'available' => true]);

    $this->putJson('/api/v1/admin/payment-methods/xpay', ['name' => 'ادفع أونلاين', 'account_label' => null, 'account_value' => null, 'instructions' => null, 'is_active' => true, 'sort_order' => 0])->assertOk();
    $this->putJson('/api/v1/admin/payment-methods/instapay', ['name' => 'إنستاباي', 'account_label' => null, 'account_value' => null, 'instructions' => null, 'is_active' => true, 'sort_order' => 1])->assertStatus(422)->assertJsonValidationErrors('account_value');
});

it('talks to XPay with the secret key, an idempotency key and checks its signature', function () {
    config(['services.xpay.secret_key' => 'sk_test_abc', 'services.xpay.base_url' => 'https://api.xpay.app']);
    Http::fake(['api.xpay.app/checkout/sessions' => Http::response(['id' => 'cs_test_Abc123456', 'url' => 'https://checkout.xpay.app/c/cs_test_Abc123456', 'status' => 'open'])]);
    $client = app(HttpXPayClient::class);

    expect($client->createSession(['afterCompletion' => ['type' => 'hosted']], 'invoice-1-x')['id'])->toBe('cs_test_Abc123456');
    Http::assertSent(fn (HttpRequest $r) => $r->url() === 'https://api.xpay.app/checkout/sessions' && $r->hasHeader('Authorization', 'Bearer sk_test_abc') && $r->hasHeader('Idempotency-Key', 'invoice-1-x'));

    $raw = '{"type":"checkout.session.completed"}';
    expect($client->signatureValid($raw, FakeXPayClient::sign($raw)))->toBeTrue()
        ->and($client->signatureValid($raw.' ', FakeXPayClient::sign($raw)))->toBeFalse()
        ->and($client->signatureValid($raw, ''))->toBeFalse();
});
