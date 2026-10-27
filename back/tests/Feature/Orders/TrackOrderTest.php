<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Tenant;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    Domain::factory()->for($this->tenant)->create(['host' => 'track.localhost', 'active_host' => 'track.localhost']);
    $this->order = asTenant($this->tenant, function () {
        $order = Order::factory()->create(['customer_phone' => '+201012345678', 'customer_phone2' => '+201112345678', 'total' => '930.00', 'governorate' => 'الجيزة']);
        OrderItem::query()->create(['order_id' => $order->id, 'product_name' => 'ساعة', 'unit_price' => '930.00', 'quantity' => 1, 'line_total' => '930.00', 'options' => [['option' => 'اللون', 'value' => 'ذهبي', 'price_delta' => 0]]]);
        $order->logs()->create(['from_status' => null, 'to_status' => OrderStatus::New]);

        return $order;
    });
});

function track(array $overrides = [])
{
    return test()->postJson('/api/v1/public/track', array_merge([
        'host' => 'track.localhost',
        'order_number' => test()->order->order_number,
        'phone' => '01012345678',
        'ip' => '41.5.5.5',
    ], $overrides), internalHeaders());
}

it('shows the order to the customer with the right phone', function () {
    track()->assertOk()
        ->assertJsonPath('data.stage', 'received')
        ->assertJsonPath('data.total', 930)
        ->assertJsonPath('data.items.0.options', ['ذهبي'])
        ->assertJsonPath('data.history.0.stage', 'received')
        ->assertJsonMissingPath('data.customer_name')
        ->assertJsonMissingPath('data.internal_note');

    // The second phone works too, in any Egyptian format.
    track(['phone' => '٠١١١٢٣٤٥٦٧٨'])->assertOk();
});

it('gives the same not-found for a wrong number or phone', function () {
    track(['phone' => '01099999999'])->assertNotFound()->assertJsonPath('code', 'order_not_found');
    track(['order_number' => 999999])->assertNotFound()->assertJsonPath('code', 'order_not_found');
    track(['phone' => 'abc'])->assertNotFound();
    track(['host' => 'other.localhost'])->assertNotFound();
    track(['order_number' => 'x'])->assertStatus(422);
});

it('never shows internal states to the customer', function () {
    asTenant($this->tenant, fn () => $this->order->forceFill(['status' => OrderStatus::Fake])->save());
    track()->assertOk()->assertJsonPath('data.stage', 'cancelled');
    asTenant($this->tenant, fn () => $this->order->forceFill(['status' => OrderStatus::Damaged])->save());
    track()->assertOk()->assertJsonPath('data.stage', 'returned');
});

it('slows down guessing: 10 lookups per minute per visitor', function () {
    for ($i = 0; $i < 10; $i++) {
        track(['phone' => '0109999999'.$i]);
    }
    track()->assertStatus(429);
    track(['ip' => '41.5.5.6'])->assertOk();
});

it('returns the store look for the tracking page', function () {
    asTenant($this->tenant, fn () => Identity::factory()->default()->create(['brand_name' => 'متجر التتبع']));
    $this->getJson('/api/v1/public/brand?host=track.localhost', internalHeaders())->assertOk()->assertJsonPath('data.identity.brand_name', 'متجر التتبع');
    $this->getJson('/api/v1/public/brand?host=nope.localhost', internalHeaders())->assertNotFound();
    $this->withHeaders(['X-Internal-Key' => ''])->postJson('/api/v1/public/track', [])->assertUnauthorized();
});
