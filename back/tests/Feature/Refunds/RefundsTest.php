<?php

declare(strict_types=1);

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Analytics\OrderCosts;
use App\Analytics\ProfitReport;
use App\Analytics\SalesFigures;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\DeliveryType;
use App\Enums\MessagePurpose;
use App\Enums\OrderPaymentState;
use App\Enums\OrderStatus;
use App\Jobs\DeliverWebhook;
use App\Mail\CustomerOrderMail;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Order;
use App\Models\OrderDelivery;
use App\Models\OrderItem;
use App\Models\OrderRefund;
use App\Models\OutboundMessage;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\ShippingCompany;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Webhook;
use App\Orders\Refunds;
use App\Services\FormToken;
use App\Store\Digital\DigitalDeliveries;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

const RF_HOST = 'refunds-shop.localhost';

beforeEach(function () {
    Mail::fake();
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $this->owner = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create(['host' => RF_HOST, 'active_host' => RF_HOST]);
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
});

/** A cash-on-delivery order placed through the store: 3 shirts (stock 10, cost 120) at 200 + 50 shipping. */
function rfStoreOrder(array $customer = []): Order
{
    $store = Store::query()->withoutGlobalScopes()->where('tenant_id', test()->owner->tenant_id)->first();
    if ($store === null) {
        test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
        test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
        test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
        $store = Store::query()->withoutGlobalScopes()->where('tenant_id', test()->owner->tenant_id)->firstOrFail();
        asTenant(test()->owner, fn () => Product::factory()->create(['slug' => 'shirt', 'name' => 'قميص', 'price' => '200.00', 'cost' => '120.00', 'stock_mode' => 'product', 'stock' => 10, 'in_store' => true]));
        test()->postJson('/api/v1/dashboard/shipping-companies', ['name' => 'بوسطة', 'default_fee' => 50, 'rates' => []])->assertCreated();
    }
    $product = asTenant(test()->owner, fn () => Product::query()->where('slug', 'shirt')->firstOrFail());
    $company = asTenant(test()->owner, fn () => ShippingCompany::query()->value('id'));

    $number = test()->postJson('/api/v1/public/store/orders', [
        'host' => RF_HOST,
        'items' => [['product_id' => $product->id, 'quantity' => 3]],
        'shipping_company_id' => $company,
        'customer' => array_merge(['name' => 'سارة محمد', 'phone' => '01012345678', 'email' => 'sara@example.com', 'governorate' => 'القاهرة', 'address' => 'شارع 9'], $customer),
        'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10),
    ], internalHeaders())->assertCreated()->json('data.order_number');

    return Order::query()->withoutGlobalScopes()->where('order_number', $number)->firstOrFail();
}

function rfDeliver(Order $order): void
{
    test()->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'confirmed'])->assertOk();
    test()->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'delivered'])->assertOk();
}

/** A paid prepaid digital order (one files line, delivered), made directly. */
function rfDigitalOrder(): array
{
    return asTenant(test()->owner, function (): array {
        $product = Product::factory()->create(['slug' => 'course', 'name' => 'كورس', 'price' => '300.00', 'kind' => 'digital', 'delivery_type' => DeliveryType::Files]);
        $order = Order::factory()->create(['order_number' => 9001, 'status' => OrderStatus::Delivered, 'payment_method' => Order::PREPAID, 'payment_method_name' => 'فودافون كاش', 'payment_status' => OrderPaymentState::Paid, 'paid_at' => now(), 'total' => '300.00', 'customer_email' => 'buyer@example.com']);
        $item = OrderItem::query()->create(['order_id' => $order->id, 'product_id' => $product->id, 'product_name' => 'كورس', 'unit_price' => '300.00', 'quantity' => 1, 'line_total' => '300.00', 'delivery_type' => 'files']);
        $delivery = OrderDelivery::query()->create(['order_id' => $order->id, 'order_item_id' => $item->id, 'product_id' => $product->id, 'type' => DeliveryType::Files, 'status' => OrderDelivery::DELIVERED, 'token' => Str::lower(Str::random(40)), 'limit' => 5, 'bonus' => 0, 'delivered_at' => now()]);

        return [$order, $item, $delivery];
    });
}

function rfStaff(array $permissions): User
{
    $staff = User::factory()->for(test()->owner->tenant)->create(['role' => 'staff']);
    $staff->givePermissionTo($permissions);
    app('auth')->forgetGuards();
    Sanctum::actingAs($staff->fresh());

    return $staff;
}

it('refunds only money that came in: a delivered cash order or a paid prepaid one', function () {
    $order = rfStoreOrder();
    // New cash-on-delivery order: nothing collected yet.
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 100, 'method' => 'cash'])->assertStatus(422)->assertJsonPath('code', 'nothing_collected');
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertJsonPath('data.refunds.collected', 0)->assertJsonPath('data.refunds.refundable', 0);

    rfDeliver($order);
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk()
        ->assertJsonPath('data.refunds.collected', 650)
        ->assertJsonPath('data.refunds.refundable', 650)
        ->assertJsonPath('data.refunds.method_name', 'كاش (الدفع عند الاستلام)')
        ->assertJsonPath('data.refunds.default_destination', '+201012345678');

    // A prepaid order counts once paid.
    [$digital] = rfDigitalOrder();
    expect(asTenant($this->owner, fn () => app(Refunds::class)->collected($digital)))->toBe(30000);
    asTenant($this->owner, fn () => $digital->forceFill(['payment_status' => OrderPaymentState::Unpaid])->save());
    expect(asTenant($this->owner, fn () => app(Refunds::class)->collected($digital->fresh())))->toBe(0);
});

it('asks a refund, never above what was paid minus the refunds asked or done', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $url = "/api/v1/dashboard/orders/{$order->id}/refunds";

    $first = $this->postJson($url, ['amount' => 400, 'method' => 'instapay', 'reason' => 'مقاس غلط'])->assertCreated()
        ->assertJsonPath('data.status', 'pending')->assertJsonPath('data.amount', 400)
        ->assertJsonPath('data.method_label', 'إنستاباي')->assertJsonPath('data.destination', '+201012345678')->json('data');

    $this->postJson($url, ['amount' => 250.01, 'method' => 'cash'])->assertStatus(422)->assertJsonValidationErrors('amount');
    $this->postJson($url, ['amount' => 250, 'method' => 'wallet', 'destination' => '01099998888'])->assertCreated();
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertJsonPath('data.refunds.refundable', 0)->assertJsonCount(2, 'data.refunds.list');

    // Cancelling one asked by mistake frees its amount.
    $this->postJson("/api/v1/dashboard/refunds/{$first['id']}/cancel")->assertOk()->assertJsonPath('data.status', 'cancelled');
    $this->postJson("/api/v1/dashboard/refunds/{$first['id']}/cancel")->assertStatus(409);
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertJsonPath('data.refunds.refundable', 400);
});

it('validates the refund', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $url = "/api/v1/dashboard/orders/{$order->id}/refunds";

    $this->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['amount', 'method']);
    $this->postJson($url, ['amount' => -5, 'method' => 'paypal'])->assertStatus(422)->assertJsonValidationErrors(['amount', 'method']);
    $this->postJson($url, ['amount' => 10.555, 'method' => 'cash'])->assertStatus(422)->assertJsonValidationErrors(['amount']);
    $item = asTenant($this->owner, fn () => $order->items()->value('id'));
    $this->postJson($url, ['amount' => 10, 'method' => 'cash', 'items' => [['order_item_id' => $item, 'quantity' => 4]]])->assertStatus(422)->assertJsonValidationErrors(['items']);
    $this->postJson($url, ['amount' => 10, 'method' => 'cash', 'items' => [['order_item_id' => 999999, 'quantity' => 1]]])->assertStatus(422)->assertJsonValidationErrors(['items']);
    $this->postJson($url, ['amount' => 10, 'method' => 'cash', 'done' => true, 'proof' => UploadedFile::fake()->create('x.exe', 10, 'application/x-msdownload')])->assertStatus(422)->assertJsonValidationErrors(['proof']);
});

it('completes a refund: refunded total, partial then full, the customer email, the webhook', function () {
    Queue::fake([DeliverWebhook::class]);
    asTenant($this->owner, fn () => Webhook::query()->create(['kind' => 'webhook', 'name' => 'x', 'url' => 'https://hooks.example.com/r', 'secret' => str_repeat('s', 48), 'events' => ['order.refunded']]));
    $order = rfStoreOrder();
    rfDeliver($order);

    $refund = $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 200, 'method' => 'wallet', 'destination' => '01099998888'])->json('data');
    $this->post("/api/v1/dashboard/refunds/{$refund['id']}/complete", ['reference' => 'TX-991', 'proof' => UploadedFile::fake()->image('proof.png')])->assertOk()
        ->assertJsonPath('data.status', 'done')->assertJsonPath('data.reference', 'TX-991')->assertJsonPath('data.has_proof', true);
    $this->postJson("/api/v1/dashboard/refunds/{$refund['id']}/complete")->assertStatus(409);
    $this->postJson("/api/v1/dashboard/refunds/{$refund['id']}/cancel")->assertStatus(409);
    $this->get("/api/v1/dashboard/refunds/{$refund['id']}/proof")->assertOk()->assertHeader('Content-Type', 'image/png');

    $fresh = $order->fresh();
    expect((string) $fresh->refunded_total)->toBe('200.00')->and($fresh->refund_state?->value)->toBe('partial');
    Mail::assertSent(CustomerOrderMail::class, fn (CustomerOrderMail $m) => $m->hasTo('sara@example.com') && $m->event === 'refunded');
    expect(OutboundMessage::query()->withoutGlobalScopes()->where('order_id', $order->id)->where('purpose', MessagePurpose::OrderRefunded->value)->count())->toBe(1);
    Queue::assertPushed(DeliverWebhook::class, fn (DeliverWebhook $job) => $job->event === 'order.refunded' && $job->data['refund']['amount'] === 200.0 && $job->data['order']['refunded'] === 200.0);

    // The rest, already sent: done at once.
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 450, 'method' => 'original', 'done' => true])->assertCreated()->assertJsonPath('data.status', 'done');
    $fresh = $order->fresh();
    expect((string) $fresh->refunded_total)->toBe('650.00')->and($fresh->refund_state?->value)->toBe('full');
    $this->getJson('/api/v1/dashboard/orders')->assertJsonPath('data.0.refund_state', 'full')->assertJsonPath('data.0.refunded_total', 650);
});

it('puts the returned units back in stock once, never more than the order took', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $stock = fn () => (int) Product::query()->withoutGlobalScopes()->where('slug', 'shirt')->value('stock');
    expect($stock())->toBe(7);
    $item = asTenant($this->owner, fn () => $order->items()->value('id'));

    $refund = $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 200, 'method' => 'cash', 'items' => [['order_item_id' => $item, 'quantity' => 1]], 'restock' => true])->assertCreated()->json('data');
    expect($stock())->toBe(7);
    $this->postJson("/api/v1/dashboard/refunds/{$refund['id']}/complete")->assertOk()->assertJsonPath('data.restocked', true);
    expect($stock())->toBe(8);
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertJsonPath("data.refunds.items_left.{$item}", 2);

    // Returning the whole order later gives back only what it still holds.
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'returned'])->assertOk();
    expect($stock())->toBe(10);

    // A refund without lines never touches stock.
    $other = rfStoreOrder(['phone' => '01055554444']);
    rfDeliver($other);
    $this->postJson("/api/v1/dashboard/orders/{$other->id}/refunds", ['amount' => 50, 'method' => 'cash', 'restock' => true, 'done' => true])->assertCreated()->assertJsonPath('data.restock', false);
});

it('stops the downloads of refunded digital lines when asked', function () {
    [$order, $item, $delivery] = rfDigitalOrder();

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 300, 'method' => 'original', 'items' => [['order_item_id' => $item->id, 'quantity' => 1]], 'revoke_digital' => true, 'done' => true])->assertCreated()
        ->assertJsonPath('data.method_label', 'فودافون كاش');

    $fresh = asTenant($this->owner, fn () => OrderDelivery::query()->findOrFail($delivery->id));
    expect($fresh->status)->toBe(OrderDelivery::REVOKED)->and($fresh->left('1'))->toBe(0)
        ->and(asTenant($this->owner, fn () => app(DigitalDeliveries::class)->download($fresh, 1)))->toBeNull();
    $this->getJson('/api/v1/public/deliveries/'.$delivery->token.'/files/1?host='.RF_HOST, internalHeaders())->assertStatus(410)->assertJsonPath('code', 'delivery_revoked');
    // The pay page shows the refund to the customer.
    expect(asTenant($this->owner, fn () => app(Refunds::class)->customerView($order->fresh())))->toBe([['amount' => 300.0, 'status' => 'done', 'method' => 'فودافون كاش', 'done_at' => $order->fresh()->refunds()->withoutGlobalScopes()->value('done_at')->toIso8601ZuluString()]]);
});

it('takes refunds off the profit, the goods put back no longer a cost', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $profit = fn () => asTenant($this->owner, fn () => app(OrderCosts::class)->profit($order->fresh()));
    $before = $profit();
    $item = asTenant($this->owner, fn () => $order->items()->value('id'));

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 200, 'method' => 'cash', 'items' => [['order_item_id' => $item, 'quantity' => 1]], 'restock' => true, 'done' => true])->assertCreated();
    $after = $profit();
    // 200 back to the customer, one shirt (cost 120) back in stock.
    expect($after['refunds'])->toBe(20000)->and($after['profit'])->toBe($before['profit'] - 20000 + 12000);

    $today = CarbonImmutable::now('Africa/Cairo')->startOfDay();
    $report = asTenant($this->owner, fn () => app(ProfitReport::class)->report($today, $today));
    expect($report['actual']['refunds'])->toBe(200.0)->and($report['refunds'])->toBe(['count' => 1, 'total' => 200.0])
        ->and($report['products'][0]['units'])->toBe(2);
    expect(asTenant($this->owner, fn () => app(SalesFigures::class)->kpis($today, $today)['sales']))->toBe(450.0);
});

it('lists the refunds, pending first by default', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 100, 'method' => 'cash'])->assertCreated();
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 50, 'method' => 'cash', 'done' => true])->assertCreated();

    $this->getJson('/api/v1/dashboard/refunds')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.order_number', $order->order_number)->assertJsonPath('meta.pending_count', 1)->assertJsonPath('meta.pending_total', 100);
    $this->getJson('/api/v1/dashboard/refunds?status=all')->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/dashboard/refunds?status=done')->assertJsonCount(1, 'data')->assertJsonPath('data.0.amount', 50);
    $this->getJson('/api/v1/dashboard/refunds?status=nope')->assertStatus(422);
});

it('needs a signed-in user with the refunds permission', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $refund = $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 100, 'method' => 'cash'])->json('data');

    rfStaff(['orders.view']);
    $this->getJson('/api/v1/dashboard/refunds')->assertForbidden();
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 100, 'method' => 'cash'])->assertForbidden();
    $this->postJson("/api/v1/dashboard/refunds/{$refund['id']}/complete")->assertForbidden();

    rfStaff(['orders.view', 'orders.refunds']);
    $this->postJson("/api/v1/dashboard/refunds/{$refund['id']}/complete")->assertOk();

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/refunds')->assertUnauthorized();
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 1, 'method' => 'cash'])->assertUnauthorized();
});

it('keeps refunds inside their store', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $refund = $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 100, 'method' => 'cash'])->json('data');

    $other = User::factory()->for(Tenant::factory()->onPlan('pro')->create())->create();
    app('auth')->forgetGuards();
    Sanctum::actingAs($other->fresh(['tenant']));
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 1, 'method' => 'cash'])->assertNotFound();
    $this->postJson("/api/v1/dashboard/refunds/{$refund['id']}/complete")->assertNotFound();
    $this->postJson("/api/v1/dashboard/refunds/{$refund['id']}/cancel")->assertNotFound();
    $this->get("/api/v1/dashboard/refunds/{$refund['id']}/proof")->assertNotFound();
    $this->getJson('/api/v1/dashboard/refunds?status=all')->assertOk()->assertJsonCount(0, 'data');
    expect(OrderRefund::query()->withoutGlobalScopes()->find($refund['id'])->status->value)->toBe('pending');
});

it('lets the copilot read refunds but never make one', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 120, 'method' => 'instapay', 'reason' => 'منتج ناقص'])->assertCreated();
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $ctx = new CopilotContext($this->owner->tenant->fresh(), $this->owner, null);
    $run = fn (string $name, array $args) => Tenancy::runAs($this->owner->tenant_id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    $list = $run('find_records', ['resource' => 'refunds']);
    $json = json_encode($list->data, JSON_UNESCAPED_UNICODE);
    expect($list->failed)->toBeFalse()->and($json)->toContain('منتج ناقص')->and($json)->not->toContain('+201012345678');

    $create = $run('create_record', ['resource' => 'refunds', 'values' => ['amount' => 10]]);
    expect($create->failed)->toBeTrue();
});

it('shows the customer the money sent back on the tracking page', function () {
    $order = rfStoreOrder();
    rfDeliver($order);
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 120, 'method' => 'wallet', 'done' => true])->assertCreated();
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/refunds", ['amount' => 30, 'method' => 'cash'])->assertCreated();

    $this->postJson('/api/v1/public/track', ['host' => RF_HOST, 'token' => $order->fresh()->track_token], internalHeaders())->assertOk()
        ->assertJsonPath('data.refunds.0.amount', 120)->assertJsonPath('data.refunds.0.status', 'done')->assertJsonPath('data.refunds.0.method', 'محفظة')
        ->assertJsonPath('data.refunds.1.status', 'pending')->assertJsonCount(2, 'data.refunds');
});
