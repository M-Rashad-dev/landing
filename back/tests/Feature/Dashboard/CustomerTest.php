<?php

declare(strict_types=1);

use App\Actions\Orders\LinkCustomer;
use App\Enums\BlockType;
use App\Enums\OrderStatus;
use App\Models\BlockedCustomer;
use App\Models\Customer;
use App\Models\Order;

beforeEach(function () {
    $this->user = actingAsOwner();
});

/** An order linked to its customer, as the order flows do. */
function customerOrder(string $phone, OrderStatus $status, string $total, array $extra = []): Order
{
    return asTenant(test()->user, function () use ($phone, $status, $total, $extra) {
        $order = Order::factory()->create(['customer_phone' => $phone, 'status' => $status, 'total' => $total] + $extra);
        app(LinkCustomer::class)->handle($order);

        return $order->fresh();
    });
}

it('lists customers with what they bought, by segment, sort and search', function () {
    customerOrder('+201011111111', OrderStatus::Delivered, '500.00', ['customer_name' => 'سارة', 'created_at' => now()->subDays(5)]);
    customerOrder('+201011111111', OrderStatus::Delivered, '300.00', ['customer_name' => 'سارة', 'created_at' => now()->subDay()]);
    // The newest order's details become the customer's.
    customerOrder('+201011111111', OrderStatus::New, '100.00', ['customer_name' => 'سارة علي']);
    customerOrder('+201022222222', OrderStatus::Returned, '900.00', ['customer_name' => 'منى', 'created_at' => now()->subDays(2)]);
    customerOrder('+201033333333', OrderStatus::Fake, '50.00', ['customer_name' => 'زائر', 'created_at' => now()->subDays(9)]);
    asTenant($this->user, fn () => BlockedCustomer::query()->create(['type' => BlockType::Phone, 'value' => '+201033333333']));

    $this->getJson('/api/v1/dashboard/customers')->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJsonPath('data.0.phone', '+201011111111')
        ->assertJsonPath('data.0.name', 'سارة علي')
        ->assertJsonPath('data.0.orders_count', 3)
        ->assertJsonPath('data.0.delivered_count', 2)
        ->assertJsonPath('data.0.open_count', 1)
        ->assertJsonPath('data.0.spent', 800)
        ->assertJsonPath('meta.counts', ['all' => 3, 'repeat' => 1, 'risky' => 2, 'blocked' => 1]);

    $this->getJson('/api/v1/dashboard/customers?segment=risky&sort=name')->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/dashboard/customers?segment=blocked')->assertJsonCount(1, 'data')->assertJsonPath('data.0.blocked', true);
    $this->getJson('/api/v1/dashboard/customers?sort=spent')->assertJsonPath('data.0.spent', 800);
    $this->getJson('/api/v1/dashboard/customers?q=01022222222')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'منى');
    $this->getJson('/api/v1/dashboard/customers?q=منى')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/customers?segment=vip&sort=x')->assertStatus(422)->assertJsonValidationErrors(['segment', 'sort']);
});

it('shows a customer with their orders, keeps a note and blocks the phone', function () {
    $order = customerOrder('+201011111111', OrderStatus::Delivered, '400.00');
    customerOrder('+201011111111', OrderStatus::Cancelled, '100.00');
    $id = $order->customer_id;

    $this->getJson("/api/v1/dashboard/customers/{$id}")->assertOk()
        ->assertJsonPath('data.counts.delivered', 1)
        ->assertJsonPath('data.counts.cancelled', 1)
        ->assertJsonPath('data.average_order', 400)
        ->assertJsonCount(2, 'data.orders')
        ->assertJsonPath('data.blocked', false);

    $this->patchJson("/api/v1/dashboard/customers/{$id}", ['note' => '  بيحب التغليف  '])->assertOk()->assertJsonPath('data.note', 'بيحب التغليف');
    $this->patchJson("/api/v1/dashboard/customers/{$id}", ['note' => str_repeat('x', 2001)])->assertStatus(422)->assertJsonValidationErrors(['note']);

    $this->postJson("/api/v1/dashboard/customers/{$id}/block", ['blocked' => true, 'reason' => 'مرتجعات'])->assertOk()->assertJsonPath('data.blocked', true);
    expect(asTenant($this->user, fn () => BlockedCustomer::isBlocked('+201011111111', null)))->toBeTrue();
    $this->postJson("/api/v1/dashboard/customers/{$id}/block", ['blocked' => false])->assertOk()->assertJsonPath('data.blocked', false);
    $this->postJson("/api/v1/dashboard/customers/{$id}/block", [])->assertStatus(422)->assertJsonValidationErrors(['blocked']);
});

it('moves an order to another customer when its phone is corrected', function () {
    $order = customerOrder('+201011111111', OrderStatus::New, '100.00');
    $this->patchJson("/api/v1/dashboard/orders/{$order->id}", ['customer_phone' => '01099999999'])->assertOk();

    $customer = asTenant($this->user, fn () => Customer::query()->where('phone', '+201099999999')->firstOrFail());
    expect($order->fresh()->customer_id)->toBe($customer->id);
});

it('keeps each store’s customers apart and needs a token', function () {
    $id = customerOrder('+201011111111', OrderStatus::New, '100.00')->customer_id;

    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/customers')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson("/api/v1/dashboard/customers/{$id}")->assertNotFound();
    $this->patchJson("/api/v1/dashboard/customers/{$id}", ['note' => 'x'])->assertNotFound();
    $this->postJson("/api/v1/dashboard/customers/{$id}/block", ['blocked' => true])->assertNotFound();

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/customers')->assertUnauthorized();
    $this->getJson("/api/v1/dashboard/customers/{$id}")->assertUnauthorized();
});
