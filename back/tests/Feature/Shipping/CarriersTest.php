<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use App\Models\Domain;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\ShippingCompany;
use App\Models\ShippingSetting;
use App\Models\UserNotification;
use App\Pricing\Basket;
use App\Pricing\Shipping;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\Carriers;
use App\Shipping\Carriers\FakeCarrier;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Mail::fake();
    $this->user = actingAsOwner();
});

function shipFake(): FakeCarrier
{
    /** @var FakeCarrier $fake */
    $fake = app(Carriers::class)->get('bosta');

    return $fake;
}

function shipConnect(array $body = []): CarrierAccount
{
    test()->postJson('/api/v1/dashboard/shipping/carriers/bosta', ['credentials' => ['api_key' => 'live-key-123']] + $body)->assertOk();

    return asTenant(test()->user, fn () => CarrierAccount::query()->firstOrFail());
}

function shipOrder(array $attributes = []): Order
{
    return asTenant(test()->user, fn () => Order::factory()->create($attributes + [
        'status' => OrderStatus::Confirmed, 'governorate' => 'القاهرة', 'city' => 'مدينة نصر', 'address' => 'شارع عباس العقاد 12', 'total' => '450.00',
    ]));
}

function shipWebhook(CarrierAccount $account, array $payload, ?string $secret = null): TestResponse
{
    return test()->postJson('/api/v1/webhooks/shipping/bosta/'.$account->webhook_token, $payload, internalHeaders() + ['X-Carrier-Auth' => $secret ?? $account->webhook_secret]);
}

it('connects the merchant\'s own Bosta account after checking the key, and never shows the key back', function () {
    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta', [])->assertStatus(422)->assertJsonValidationErrors(['credentials', 'credentials.api_key']);
    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta', ['credentials' => ['api_key' => 'bad']])->assertStatus(422)->assertJsonValidationErrors(['credentials.api_key']);
    $this->postJson('/api/v1/dashboard/shipping/carriers/nope', ['credentials' => ['api_key' => 'live-key-123']])->assertNotFound();

    $json = $this->postJson('/api/v1/dashboard/shipping/carriers/bosta', ['credentials' => ['api_key' => 'live-key-123', 'extra' => 'dropped']])->assertOk()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.settings.location_id', 'loc-main')
        ->assertJsonPath('data.company.name', 'بوسطة')
        ->assertJsonPath('data.company.is_active', false)
        ->json();
    expect(json_encode($json))->not->toContain('live-key-123');

    $account = asTenant($this->user, fn () => CarrierAccount::query()->firstOrFail());
    expect($account->credentials)->toBe(['api_key' => 'live-key-123'])
        ->and($account->getRawOriginal('credentials'))->not->toContain('live-key-123')
        ->and($account->webhook_token)->toMatch('/^[a-z0-9]{40}$/');
    $this->getJson('/api/v1/dashboard/shipping/carriers')->assertOk()
        ->assertJsonPath('data.0.key', 'bosta')->assertJsonPath('data.0.name', 'بوسطة')->assertJsonPath('data.0.account.status', 'active')
        ->assertJsonPath('data.0.fields.0.key', 'api_key')->assertJsonPath('data.0.features', ['locations', 'pickup', 'package'])
        ->assertJsonPath('data.1.key', 'jt')->assertJsonPath('data.1.account', null)->assertJsonCount(4, 'data.1.fields');

    // Connecting again keeps the same webhook address and the same company.
    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta', ['credentials' => ['api_key' => 'other-key-456']])->assertOk();
    expect(asTenant($this->user, fn () => [CarrierAccount::query()->value('webhook_token'), ShippingCompany::query()->count()]))->toBe([$account->webhook_token, 1]);
});

it('links an existing company, never another store\'s, and needs a signed-in user', function () {
    $company = asTenant($this->user, fn () => ShippingCompany::query()->create(['name' => 'بوسطة بتاعتي', 'default_fee' => 50, 'is_active' => true]));
    $foreign = asTenant(createOwner(), fn () => ShippingCompany::query()->create(['name' => 'غريبة', 'default_fee' => 50]));

    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta', ['credentials' => ['api_key' => 'live-key-123'], 'company_id' => $foreign->id])->assertStatus(422)->assertJsonValidationErrors(['company_id']);
    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta', ['credentials' => ['api_key' => 'live-key-123'], 'company_id' => $company->id])->assertOk()->assertJsonPath('data.company.id', $company->id);
    expect(asTenant($this->user, fn () => ShippingCompany::query()->count()))->toBe(1);
    $this->getJson('/api/v1/dashboard/shipping')->assertJsonPath('data.companies.0.carrier', 'bosta');

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/shipping/carriers')->assertUnauthorized();
    $this->postJson('/api/v1/dashboard/shipments/bulk', ['order_ids' => [1]])->assertUnauthorized();
});

it('saves settings, checks the key again, and disconnects keeping the company', function () {
    shipConnect();
    $this->putJson('/api/v1/dashboard/shipping/carriers/bosta', ['size' => 'HUGE', 'label_size' => 'A3'])->assertStatus(422)->assertJsonValidationErrors(['size', 'label_size']);
    $this->putJson('/api/v1/dashboard/shipping/carriers/bosta', ['auto_ship' => true, 'allow_open' => true, 'label_size' => 'A6', 'location_id' => 'loc-branch'])->assertOk()
        ->assertJsonPath('data.settings.auto_ship', true)->assertJsonPath('data.settings.label_size', 'A6')->assertJsonPath('data.settings.location_id', 'loc-branch');
    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta/check')->assertOk()->assertJsonCount(2, 'data.locations');

    // A revoked key turns the account failed.
    asTenant($this->user, function () {
        $a = CarrierAccount::query()->firstOrFail();
        $a->credentials = ['api_key' => 'bad'];
        $a->save();
    });
    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta/check')->assertStatus(422)->assertJsonPath('code', 'carrier_auth');
    expect(asTenant($this->user, fn () => CarrierAccount::query()->value('status')))->toBe('failed');

    $this->deleteJson('/api/v1/dashboard/shipping/carriers/bosta')->assertNoContent();
    expect(asTenant($this->user, fn () => [CarrierAccount::query()->count(), ShippingCompany::query()->whereNull('carrier_account_id')->count()]))->toBe([0, 1]);
    $this->deleteJson('/api/v1/dashboard/shipping/carriers/bosta')->assertNotFound();
});

it('ships a confirmed order: area from the city, the total to collect, the tracking number on the order', function () {
    shipConnect();
    $new = shipOrder(['status' => OrderStatus::New]);
    $this->postJson("/api/v1/dashboard/orders/{$new->id}/shipments", ['carrier' => 'bosta'])->assertStatus(422)->assertJsonPath('code', 'ship_not_confirmed');

    $order = shipOrder(['order_number' => 7001]);
    $this->getJson("/api/v1/dashboard/orders/{$order->id}/shipping")->assertOk()
        ->assertJsonPath('data.default_carrier', 'bosta')->assertJsonPath('data.area.matched', 'd-nasr')->assertJsonPath('data.cod', 450)->assertJsonPath('data.can_ship', true);

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta', 'cod' => 99999])->assertStatus(422)->assertJsonValidationErrors(['cod']);
    $shipment = $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta', 'notes' => 'اتصل قبلها'])->assertCreated()
        ->assertJsonPath('data.state', 'created')->assertJsonPath('data.state_label', 'مستني المندوب')->assertJsonPath('data.cod', 450)->assertJsonPath('data.can_cancel', true)
        ->json('data');

    $draft = shipFake()->created[array_key_last(shipFake()->created)];
    expect($draft->reference)->toBe('7001')->and($draft->districtId)->toBe('d-nasr')->and($draft->cod)->toBe(45000)
        ->and($draft->notes)->toContain('اتصل قبلها')->and($draft->webhookUrl)->toContain('/api/webhooks/shipping/bosta/');
    expect(asTenant($this->user, fn () => [Order::query()->find($order->id)->tracking_number, Order::query()->find($order->id)->status]))->toBe([$shipment['tracking_number'], OrderStatus::Confirmed]);

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->assertStatus(409)->assertJsonPath('code', 'ship_exists');
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk()->assertJsonPath('data.shipment.tracking_number', $shipment['tracking_number']);
});

it('asks for the area when the city doesn\'t match, refuses a short address, and says the carrier\'s reason', function () {
    shipConnect();
    $order = shipOrder(['city' => 'عزبة مش معروفة']);
    $this->getJson("/api/v1/dashboard/orders/{$order->id}/shipping")->assertOk()->assertJsonPath('data.area.matched', null)->assertJsonCount(3, 'data.area.districts');
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->assertStatus(422)->assertJsonPath('code', 'ship_district_needed');

    shipFake()->failNext = new CarrierError('بوسطة رفضت الطلب: Zone not found');
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta', 'district_id' => 'd-maadi'])->assertStatus(422)
        ->assertJsonPath('code', 'carrier_refused')->assertJsonPath('message', 'بوسطة رفضت الطلب: Zone not found');
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta', 'district_id' => 'd-maadi'])->assertCreated();

    $short = shipOrder(['address' => 'شارع']);
    $this->postJson("/api/v1/dashboard/orders/{$short->id}/shipments", ['carrier' => 'bosta'])->assertStatus(422)->assertJsonPath('code', 'ship_address_short');
});

it('never ships or cancels another store\'s orders', function () {
    shipConnect();
    $other = createOwner();
    $foreign = asTenant($other, fn () => Order::factory()->create(['status' => OrderStatus::Confirmed]));
    $foreignShipment = asTenant($other, fn () => Shipment::query()->create(['order_id' => $foreign->id, 'carrier' => 'bosta', 'tracking_number' => 'X1', 'state' => ShipmentState::Created]));

    $this->getJson("/api/v1/dashboard/orders/{$foreign->id}/shipping")->assertNotFound();
    $this->postJson("/api/v1/dashboard/orders/{$foreign->id}/shipments", ['carrier' => 'bosta'])->assertNotFound();
    $this->postJson("/api/v1/dashboard/shipments/{$foreignShipment->id}/cancel")->assertNotFound();
    $this->postJson('/api/v1/dashboard/shipments/bulk', ['order_ids' => [$foreign->id]])->assertStatus(422)->assertJsonValidationErrors(['order_ids.0']);
    $this->getJson('/api/v1/dashboard/shipments/labels?ids[]='.$foreignShipment->id)->assertStatus(422);
});

it('ships many orders with a result for each one', function () {
    shipConnect();
    $good = shipOrder();
    $unconfirmed = shipOrder(['status' => OrderStatus::New]);
    $noArea = shipOrder(['city' => 'مكان غريب']);

    $results = collect($this->postJson('/api/v1/dashboard/shipments/bulk', ['order_ids' => [$good->id, $unconfirmed->id, $noArea->id]])->assertOk()->json('data'))->keyBy('order_id');
    expect($results[$good->id]['ok'])->toBeTrue()
        ->and($results[$unconfirmed->id])->toMatchArray(['ok' => false, 'code' => 'ship_not_confirmed'])
        ->and($results[$noArea->id])->toMatchArray(['ok' => false, 'code' => 'ship_district_needed']);
    $this->postJson('/api/v1/dashboard/shipments/bulk', ['order_ids' => range(1, 11)])->assertStatus(422)->assertJsonValidationErrors(['order_ids']);
});

it('moves the order with the carrier\'s updates, through «تم الشحن», and ignores old news', function () {
    $account = shipConnect();
    $order = shipOrder();
    $tracking = $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->json('data.tracking_number');

    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'picked_up'], 'wrong')->assertForbidden();
    $this->postJson('/api/v1/webhooks/shipping/bosta/'.str_repeat('a', 40), ['trackingNumber' => $tracking, 'state' => 'picked_up'], internalHeaders() + ['X-Carrier-Auth' => $account->webhook_secret])->assertNotFound();
    $this->postJson('/api/v1/webhooks/shipping/bosta/'.$account->webhook_token, [], ['X-Carrier-Auth' => $account->webhook_secret])->assertUnauthorized();

    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'picked_up', 'at' => now()->toIso8601String()])->assertOk();
    expect(asTenant($this->user, fn () => Order::query()->find($order->id)->status))->toBe(OrderStatus::Shipped);

    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'delivered', 'at' => now()->addHour()->toIso8601String()])->assertOk();
    // An older update arriving late changes nothing.
    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'in_transit', 'at' => now()->subDay()->toIso8601String()])->assertOk();
    shipWebhook($account, ['trackingNumber' => 'UNKNOWN', 'state' => 'delivered'])->assertOk();

    $shipment = asTenant($this->user, fn () => Shipment::query()->with('events')->firstOrFail());
    expect($shipment->state)->toBe(ShipmentState::Delivered)->and($shipment->is_open)->toBeFalse()
        ->and($shipment->events->pluck('state')->map->value->all())->toBe(['created', 'picked_up', 'delivered'])
        ->and(asTenant($this->user, fn () => Order::query()->find($order->id)->status))->toBe(OrderStatus::Delivered);
});

it('returns a refused order to stock through «تم الشحن», and tells the merchant about problems', function () {
    $account = shipConnect();
    $order = shipOrder();
    $tracking = $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->json('data.tracking_number');

    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'exception', 'note' => 'العميل مش بيرد'])->assertOk();
    $bell = UserNotification::query()->where('user_id', $this->user->id)->where('event', 'shipment_problem')->latest('id')->first();
    expect($bell)->not->toBeNull()->and($bell->body)->toContain('العميل مش بيرد');

    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'returned', 'at' => now()->addMinute()->toIso8601String()])->assertOk();
    $statuses = asTenant($this->user, fn () => Order::query()->with('logs')->find($order->id)->logs->pluck('to_status')->map->value->all());
    expect($statuses)->toBe(['shipped', 'returned']);
});

it('cancels a shipment before pickup only, and prints airway bills as a PDF', function () {
    $account = shipConnect();
    $order = shipOrder();
    $id = $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->json('data.id');

    $pdf = $this->get('/api/v1/dashboard/shipments/labels?ids[]='.$id)->assertOk()->assertHeader('Content-Type', 'application/pdf');
    expect($pdf->getContent())->toStartWith('%PDF');
    $this->get('/api/v1/dashboard/shipments/labels?order_ids[]='.$order->id.'&size=A6')->assertOk();

    $this->postJson("/api/v1/dashboard/shipments/{$id}/cancel")->assertOk()->assertJsonPath('data.state', 'cancelled')->assertJsonPath('data.is_open', false);
    expect(asTenant($this->user, fn () => [Order::query()->find($order->id)->status, Order::query()->find($order->id)->tracking_number]))->toBe([OrderStatus::Confirmed, null]);
    $this->getJson('/api/v1/dashboard/shipments/labels?ids[]='.$id)->assertStatus(422)->assertJsonPath('code', 'labels_none');

    // Shipped again, picked up: too late to cancel.
    $tracking = $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->assertCreated()->json('data.tracking_number');
    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'picked_up'])->assertOk();
    $second = asTenant($this->user, fn () => Shipment::query()->where('tracking_number', $tracking)->value('id'));
    $this->postJson("/api/v1/dashboard/shipments/{$second}/cancel")->assertStatus(422)->assertJsonPath('code', 'ship_cancel_late');
});

it('ships by itself on confirming when the store asks, and tells the merchant when it can\'t', function () {
    $account = shipConnect();
    $company = asTenant($this->user, fn () => ShippingCompany::query()->firstOrFail());
    $this->putJson('/api/v1/dashboard/shipping/carriers/bosta', ['auto_ship' => true])->assertOk();
    $order = shipOrder(['status' => OrderStatus::New, 'shipping_company_id' => $company->id]);
    $lost = shipOrder(['status' => OrderStatus::New, 'shipping_company_id' => $company->id, 'city' => 'مكان غريب']);

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'confirmed'])->assertOk();
    $this->postJson("/api/v1/dashboard/orders/{$lost->id}/status", ['status' => 'confirmed'])->assertOk();

    expect(asTenant($this->user, fn () => Shipment::query()->where('order_id', $order->id)->exists()))->toBeTrue()
        ->and(asTenant($this->user, fn () => Shipment::query()->where('order_id', $lost->id)->exists()))->toBeFalse()
        ->and(UserNotification::query()->where('user_id', $this->user->id)->where('event', 'shipment_problem')->count())->toBe(1);
    expect($account->fresh())->not->toBeNull();
});

it('refreshes open shipments nobody heard of, and asks for a courier', function () {
    shipConnect();
    $order = shipOrder();
    $tracking = $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->json('data.tracking_number');
    shipFake()->states[$tracking] = ShipmentState::OutForDelivery;
    $this->travel(3)->hours();

    $this->artisan('shipments:sync')->assertSuccessful();
    expect(asTenant($this->user, fn () => [Shipment::query()->value('state'), Order::query()->find($order->id)->status]))->toBe([ShipmentState::OutForDelivery, OrderStatus::Shipped]);

    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta/pickups', ['date' => now()->subDay()->toDateString(), 'parcels' => 0])->assertStatus(422)->assertJsonValidationErrors(['date', 'parcels']);
    $this->postJson('/api/v1/dashboard/shipping/carriers/bosta/pickups', ['date' => now('Africa/Cairo')->addDay()->toDateString(), 'parcels' => 3])->assertNoContent();
    expect(shipFake()->pickups[array_key_last(shipFake()->pickups)]->parcels)->toBe(3);
});

it('shows the customer the carrier timeline on the tracking page', function () {
    $account = shipConnect();
    $host = asTenant($this->user, fn () => Domain::query()->value('active_host'));
    $order = shipOrder();
    $tracking = $this->postJson("/api/v1/dashboard/orders/{$order->id}/shipments", ['carrier' => 'bosta'])->json('data.tracking_number');
    shipWebhook($account, ['trackingNumber' => $tracking, 'state' => 'picked_up'])->assertOk();

    $this->postJson('/api/v1/public/track', ['host' => $host, 'token' => $order->track_token], internalHeaders())->assertOk()
        ->assertJsonPath('data.shipment.tracking_number', $tracking)
        ->assertJsonPath('data.shipment.state_label', 'المندوب استلم')
        ->assertJsonCount(2, 'data.shipment.events');
});

it('lets the store pick the company per governorate, so checkout shows no choice', function () {
    $cheap = asTenant($this->user, fn () => ShippingCompany::query()->create(['name' => 'رخيصة', 'default_fee' => 30, 'is_active' => true]));
    $fast = asTenant($this->user, fn () => ShippingCompany::query()->create(['name' => 'سريعة', 'default_fee' => 60, 'is_active' => true]));
    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true, 'company_choice' => 'governorate', 'governorate_companies' => ['باريس' => $fast->id]])->assertStatus(422);
    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true, 'company_choice' => 'governorate', 'governorate_companies' => ['القاهرة' => $fast->id]])->assertOk()
        ->assertJsonPath('data.company_choice', 'governorate')->assertJsonPath('data.governorate_companies.القاهرة', $fast->id);

    $quote = asTenant($this->user, fn () => app(Shipping::class)->quote('القاهرة', $cheap->id, 10000, new Basket([]), false, now()));
    expect($quote->options)->toHaveCount(1)->and($quote->company['id'])->toBe($fast->id)->and($quote->fee)->toBe(6000);
    // Not assigned: the cheapest, still one option.
    $other = asTenant($this->user, fn () => app(Shipping::class)->quote('الجيزة', null, 10000, new Basket([]), false, now()));
    expect($other->options)->toHaveCount(1)->and($other->company['id'])->toBe($cheap->id);
    expect(asTenant($this->user, fn () => ShippingSetting::query()->value('company_choice')))->toBe('governorate');
});

it('connects J&T with its four fields, shows the address to paste in its console, and saves the pickup address', function () {
    $this->postJson('/api/v1/dashboard/shipping/carriers/jt', ['credentials' => ['customer_code' => 'J0086024225']])->assertStatus(422)
        ->assertJsonValidationErrors(['credentials.password', 'credentials.api_account', 'credentials.private_key']);
    $this->postJson('/api/v1/dashboard/shipping/carriers/jt', ['credentials' => ['customer_code' => 'J1', 'password' => 'bad', 'api_account' => '10', 'private_key' => 'kk']])->assertStatus(422)
        ->assertJsonValidationErrors(['credentials.customer_code']);
    $this->postJson('/api/v1/dashboard/shipping/carriers/jt', ['credentials' => ['customer_code' => 'J0086024225', 'password' => 'p4ss', 'api_account' => '2925', 'private_key' => 'key-1']])->assertOk()
        ->assertJsonPath('data.company.name', 'J&T Express');

    $jt = collect($this->getJson('/api/v1/dashboard/shipping/carriers')->assertOk()->json('data'))->firstWhere('key', 'jt');
    expect($jt['features'])->toBe(['sender', 'webhook_url'])->and($jt['webhook_url'])->toContain('/api/webhooks/shipping/jt/');

    $this->putJson('/api/v1/dashboard/shipping/carriers/jt', ['sender_phone' => '+20100', 'service_type' => '03', 'weight' => 99])->assertStatus(422)
        ->assertJsonValidationErrors(['sender_phone', 'service_type', 'weight']);
    $this->putJson('/api/v1/dashboard/shipping/carriers/jt', ['sender_name' => 'متجر حبة', 'sender_phone' => '01012345678', 'sender_governorate' => 'الجيزة', 'sender_area' => 'الشيخ زايد|الشيخ زايد', 'sender_street' => 'شارع 1', 'service_type' => '02'])->assertOk()
        ->assertJsonPath('data.settings.sender_phone', '01012345678')->assertJsonPath('data.settings.service_type', '02');
});
