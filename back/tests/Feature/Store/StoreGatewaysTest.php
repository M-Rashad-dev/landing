<?php

declare(strict_types=1);

use App\Enums\OrderPaymentState;
use App\Enums\OrderStatus;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\StoreGatewayAccount;
use App\Models\StoreOnlinePayment;
use App\Models\StorePaymentMethod;
use App\Models\Tenant;
use App\Models\User;
use App\Services\FormToken;
use App\Store\Payments\Gateways\FakeStoreGateway;
use App\Store\Payments\Gateways\GatewayResult;
use App\Store\Payments\Gateways\StoreGateways;
use Database\Seeders\ThemeSeeder;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

const SG_HOST = 'gw-shop.localhost';

beforeEach(function () {
    Mail::fake();
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->onPlan('pro')->create(['name' => 'متجر حبة']);
    $this->owner = User::factory()->for($this->tenant)->create();
    Domain::factory()->for($this->tenant)->create(['host' => SG_HOST, 'active_host' => SG_HOST, 'is_primary' => true]);
    asTenant($this->tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
});

function sgFake(string $gateway = 'paymob'): FakeStoreGateway
{
    /** @var FakeStoreGateway $fake */
    $fake = app(StoreGateways::class)->get($gateway);

    return $fake;
}

function sgConnect(string $gateway = 'paymob', array $credentials = []): TestResponse
{
    $fields = collect(app(StoreGateways::class)->get($gateway)->credentialFields())->mapWithKeys(fn ($f) => [$f['key'] => 'test-'.$f['key']])->all();

    return test()->putJson("/api/v1/dashboard/payments/gateways/{$gateway}", ['credentials' => $credentials + $fields]);
}

/** A prepaid store order paid with the online method (200 + shipping 0). */
function sgOrder(): Order
{
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
    $store = asTenant(test()->tenant, fn () => Store::query()->firstOrFail());
    $product = asTenant(test()->tenant, fn () => Product::factory()->create(['name' => 'كورس', 'price' => '200.00', 'in_store' => true]));
    $method = asTenant(test()->tenant, fn () => StorePaymentMethod::query()->where('kind', 'online')->firstOrFail());

    test()->postJson('/api/v1/public/store/orders', [
        'host' => SG_HOST,
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'customer' => ['name' => 'سارة محمد', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع 9', 'email' => 'sara@example.com'],
        'payment_method' => (string) $method->id,
        'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10),
    ], internalHeaders())->assertCreated();

    return asTenant(test()->tenant, fn () => Order::query()->latest('id')->firstOrFail());
}

function sgPay(Order $order): TestResponse
{
    return test()->postJson('/api/v1/public/payments/online', ['host' => SG_HOST, 'token' => $order->track_token], internalHeaders());
}

function sgReference(Order $order): string
{
    return (string) StoreOnlinePayment::query()->withoutGlobalScopes()->where('order_id', $order->id)->latest('id')->value('reference');
}

function sgHook(string $raw, ?string $signature = null, string $gateway = 'paymob', ?string $token = null): TestResponse
{
    $token ??= (string) StoreGatewayAccount::query()->withoutGlobalScopes()->where('gateway', $gateway)->value('webhook_token');

    return test()->call('POST', "/api/v1/webhooks/payments/{$gateway}/{$token}", [], [], [], test()->transformHeadersToServerVars(internalHeaders() + [
        'Content-Type' => 'application/json', 'X-Fake-Signature' => $signature ?? FakeStoreGateway::sign($raw),
    ]), $raw);
}

it('connects a gateway with the merchant\'s own keys and shows its method at checkout', function () {
    $this->getJson('/api/v1/dashboard/payments')->assertOk()
        ->assertJsonPath('data.gateways.0.key', 'paymob')->assertJsonPath('data.gateways.0.connected', false)
        ->assertJsonPath('data.gateways.1.key', 'kashier')->assertJsonPath('data.gateways.2.key', 'xpay')
        ->assertJsonPath('data.gateways.2.fields.0.key', 'secret_key');

    sgConnect('paymob', ['secret_key' => 'wrong'])->assertStatus(422)->assertJsonValidationErrors('credentials');
    $this->putJson('/api/v1/dashboard/payments/gateways/paymob', ['credentials' => ['secret_key' => 'x']])->assertStatus(422)->assertJsonValidationErrors('credentials.public_key');
    $this->putJson('/api/v1/dashboard/payments/gateways/stripe', ['credentials' => ['secret_key' => 'x']])->assertNotFound();

    $data = sgConnect()->assertOk()->json('data');
    expect(collect($data['gateways'])->firstWhere('key', 'paymob'))->toMatchArray(['connected' => true, 'mode' => 'test', 'status' => 'active'])
        ->and(collect($data['methods'])->firstWhere('kind', 'online'))->toMatchArray(['gateway' => 'paymob', 'is_active' => true]);
    // The keys never come back, and they're stored encrypted.
    expect(json_encode($data))->not->toContain('test-secret_key');
    $raw = DB::table('store_gateway_accounts')->value('credentials');
    expect($raw)->not->toContain('test-secret_key');

    // An online method follows its gateway: not edited or deleted by hand.
    $method = collect($data['methods'])->firstWhere('kind', 'online');
    $this->putJson("/api/v1/dashboard/payments/methods/{$method['id']}", ['kind' => 'wallet', 'name' => 'x', 'account' => '0100'])->assertStatus(422)->assertJsonPath('code', 'gateway_method');
    $this->deleteJson("/api/v1/dashboard/payments/methods/{$method['id']}")->assertStatus(422);
    $this->postJson('/api/v1/dashboard/payments/methods', ['kind' => 'online', 'name' => 'x'])->assertStatus(422)->assertJsonValidationErrors('kind');
});

it('pays an order on the gateway and confirms it once, from the gateway itself', function () {
    sgConnect();
    $order = sgOrder();
    expect($order->status)->toBe(OrderStatus::AwaitingPayment);

    $url = sgPay($order)->assertOk()->json('data.url');
    expect($url)->toStartWith('https://pay.example.com/paymob/');
    $sent = sgFake()->opened[0];
    expect($sent->amountCents)->toBe($order->totalCents())
        ->and($sent->returnUrl)->toEndWith('/pay/'.$order->track_token.'?ref='.$sent->reference)
        ->and($sent->webhookUrl)->toContain('/api/webhooks/payments/paymob/');

    // Back before paying: still waiting.
    $ref = sgReference($order);
    $this->postJson('/api/v1/public/payments/lookup', ['host' => SG_HOST, 'token' => $order->track_token, 'ref' => $ref], internalHeaders())->assertOk()->assertJsonPath('data.status', 'awaiting');

    sgFake()->results[$ref] = new GatewayResult(GatewayResult::PAID, $order->totalCents(), 'TX-1', 'card');
    $this->postJson('/api/v1/public/payments/lookup', ['host' => SG_HOST, 'token' => $order->track_token, 'ref' => $ref], internalHeaders())->assertOk()
        ->assertJsonPath('data.status', 'paid')->assertJsonPath('data.online.status', 'paid');
    sgHook(json_encode(['reference' => $ref]))->assertOk();

    $order->refresh();
    expect($order->status)->toBe(OrderStatus::Confirmed)->and($order->payment_status)->toBe(OrderPaymentState::Paid)
        ->and(asTenant($this->tenant, fn () => $order->logs()->where('to_status', 'confirmed')->count()))->toBe(1)
        ->and(StoreOnlinePayment::query()->withoutGlobalScopes()->where('reference', $ref)->value('payment_ref'))->toBe('TX-1');
});

it('waits for a kiosk payment, and never confirms a smaller amount', function () {
    sgConnect();
    $order = sgOrder();
    sgPay($order)->assertOk();
    $ref = sgReference($order);

    sgFake()->results[$ref] = new GatewayResult(GatewayResult::WAITING);
    sgHook(json_encode(['reference' => $ref]))->assertOk();
    expect(StoreOnlinePayment::query()->withoutGlobalScopes()->where('reference', $ref)->value('status'))->toBe('waiting');

    sgFake()->results[$ref] = new GatewayResult(GatewayResult::PAID, 100);
    sgHook(json_encode(['reference' => $ref]))->assertOk();
    expect(StoreOnlinePayment::query()->withoutGlobalScopes()->where('reference', $ref)->value('status'))->toBe('failed')
        ->and($order->fresh()->status)->toBe(OrderStatus::AwaitingPayment);
});

it('refuses webhooks with a wrong signature or another store\'s address', function () {
    sgConnect();
    $order = sgOrder();
    sgPay($order)->assertOk();
    $ref = sgReference($order);
    sgFake()->results[$ref] = new GatewayResult(GatewayResult::PAID, $order->totalCents());

    sgHook(json_encode(['reference' => $ref]), 'forged')->assertForbidden();
    sgHook(json_encode(['reference' => $ref]), token: str_repeat('a', 40))->assertForbidden();
    // The Paymob account's address under another gateway's name.
    sgHook(json_encode(['reference' => $ref]), gateway: 'kashier', token: (string) StoreGatewayAccount::query()->withoutGlobalScopes()->value('webhook_token'))->assertForbidden();
    expect($order->fresh()->status)->toBe(OrderStatus::AwaitingPayment);
});

it('keeps checkouts inside their store and hides the method when the gateway is down', function () {
    sgConnect();
    $order = sgOrder();
    sgPay($order)->assertOk();
    $ref = sgReference($order);
    sgFake()->results[$ref] = new GatewayResult(GatewayResult::PAID, $order->totalCents());

    // Another store's order can't settle this checkout.
    $otherTenant = Tenant::factory()->onPlan('pro')->create();
    Domain::factory()->for($otherTenant)->create(['host' => 'other-gw.localhost', 'active_host' => 'other-gw.localhost', 'is_primary' => true]);
    $other = asTenant($otherTenant, fn () => Order::factory()->create(['payment_method' => Order::PREPAID, 'status' => OrderStatus::AwaitingPayment]));
    $this->postJson('/api/v1/public/payments/lookup', ['host' => 'other-gw.localhost', 'token' => $other->track_token, 'ref' => $ref], internalHeaders())->assertOk()->assertJsonPath('data.status', 'awaiting');
    expect($order->fresh()->status)->toBe(OrderStatus::AwaitingPayment);

    // A failed account: the method stops showing at checkout.
    asTenant($this->tenant, fn () => StoreGatewayAccount::query()->update(['status' => 'failed']));
    $this->postJson('/api/v1/public/payments/lookup', ['host' => SG_HOST, 'token' => $order->track_token], internalHeaders())->assertOk()->assertJsonCount(0, 'data.methods');
    sgPay($order)->assertStatus(409);
});

it('tells the customer when the gateway is down', function () {
    sgConnect();
    $order = sgOrder();
    sgFake()->fail = 'down';
    sgPay($order)->assertStatus(502)->assertJsonPath('code', 'gateway_unavailable');
});

it('disconnects only when no order still waits to pay with it', function () {
    sgConnect();
    $order = sgOrder();
    $this->deleteJson('/api/v1/dashboard/payments/gateways/paymob')->assertStatus(422)->assertJsonPath('code', 'method_used');

    asTenant($this->tenant, fn () => $order->forceFill(['status' => OrderStatus::Cancelled])->save());
    $this->deleteJson('/api/v1/dashboard/payments/gateways/paymob')->assertOk()->assertJsonPath('data.gateways.0.connected', false);
    expect(asTenant($this->tenant, fn () => StorePaymentMethod::query()->where('kind', 'online')->value('is_active')))->toBeFalse();
});

it('needs the payments permission and keeps accounts per store', function () {
    $staff = User::factory()->for($this->tenant)->create(['role' => 'staff']);
    $staff->givePermissionTo(['payments.view']);
    app('auth')->forgetGuards();
    Sanctum::actingAs($staff->fresh());
    sgConnect()->assertForbidden();

    app('auth')->forgetGuards();
    $this->putJson('/api/v1/dashboard/payments/gateways/paymob', ['credentials' => []])->assertUnauthorized();

    $other = User::factory()->for(Tenant::factory()->onPlan('pro')->create())->create();
    Sanctum::actingAs($this->owner->fresh(['tenant']));
    sgConnect()->assertOk();
    app('auth')->forgetGuards();
    Sanctum::actingAs($other->fresh(['tenant']));
    $this->getJson('/api/v1/dashboard/payments')->assertJsonPath('data.gateways.0.connected', false);
    $this->deleteJson('/api/v1/dashboard/payments/gateways/paymob')->assertNotFound();
});
