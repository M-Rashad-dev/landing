<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\Order;

beforeEach(function () {
    $this->user = actingAsOwner();
});

function cycleOrder(array $attributes = []): Order
{
    return asTenant(test()->user, fn () => Order::factory()->create($attributes));
}

it('ships an order with a tracking number and a note, then delivers it', function () {
    $order = cycleOrder(['status' => OrderStatus::Confirmed]);

    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'shipped', 'tracking_number' => ' BOS-123 ', 'note' => 'سلّمناه لبوسطة'])
        ->assertOk()
        ->assertJsonPath('data.status', 'shipped')
        ->assertJsonPath('data.shipping.tracking_number', 'BOS-123')
        ->assertJsonPath('data.logs.0.note', 'سلّمناه لبوسطة')
        ->assertJsonPath('data.allowed_transitions.0.status', 'delivered');

    // The tracking number stays editable after shipping (not a customer field).
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'delivered'])->assertOk();
    $this->patchJson("/api/v1/dashboard/orders/{$order->id}", ['tracking_number' => 'BOS-999'])->assertOk()->assertJsonPath('data.shipping.tracking_number', 'BOS-999');
    $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'shipped', 'tracking_number' => str_repeat('x', 61)])->assertStatus(422)->assertJsonValidationErrors(['tracking_number']);
});

it('filters by several statuses, source, governorate, company and customer', function () {
    cycleOrder(['status' => OrderStatus::Returned, 'governorate' => 'أسوان']);
    cycleOrder(['status' => OrderStatus::Damaged, 'source' => 'store', 'shipping_company_id' => 7, 'shipping_company_name' => 'بوسطة']);
    cycleOrder(['status' => OrderStatus::New, 'source' => 'store', 'customer_id' => null]);

    $this->getJson('/api/v1/dashboard/orders?status=returned,damaged')->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/dashboard/orders?source=store')->assertJsonCount(2, 'data');
    $this->getJson('/api/v1/dashboard/orders?source=landing')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/orders?governorate=أسوان')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/orders?shipping_company_id=7')->assertJsonCount(1, 'data')->assertJsonPath('data.0.shipping_company', 'بوسطة');
    $this->getJson('/api/v1/dashboard/orders/stats?source=store')->assertJsonPath('data.all', 2);
});

it('keeps shipped orders closed to customer edits and stock returns', function () {
    expect(OrderStatus::Shipped->customerStage())->toBe('shipped')
        ->and(OrderStatus::Shipped->restocks())->toBeFalse()
        ->and(OrderStatus::Shipped->allowsCustomerEdits())->toBeFalse();
});
