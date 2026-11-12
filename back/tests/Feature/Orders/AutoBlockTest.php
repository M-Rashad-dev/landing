<?php

declare(strict_types=1);

use App\Actions\Orders\AutoBlock;
use App\Actions\Orders\LinkCustomer;
use App\Enums\OrderStatus;
use App\Models\BlockedCustomer;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;

beforeEach(function () {
    $this->user = actingAsOwner();
    [$this->a, $this->b] = asTenant($this->user, fn () => [Product::factory()->create(), Product::factory()->create()]);
});

const PHONE = '+201012345678';

/** An order of the phone (landing by default), linked to its customer, then the rules run. */
function blockOrder(array $attributes = [], ?array $productIds = null): Order
{
    return asTenant(test()->user, function () use ($attributes, $productIds) {
        $order = Order::factory()->create($attributes + ['customer_phone' => PHONE, 'product_id' => test()->a->id]);
        foreach ($productIds ?? [] as $id) {
            $order->items()->create(['product_id' => $id, 'product_name' => 'x', 'unit_price' => '10.00', 'quantity' => 1, 'line_total' => '10.00']);
        }
        app(LinkCustomer::class)->handle($order);
        app(AutoBlock::class)->afterOrder($order);

        return $order;
    });
}

function blockedRule(): ?string
{
    return asTenant(test()->user, fn () => BlockedCustomer::query()->where('value', PHONE)->value('rule'));
}

it('blocks a landing phone after the same order 3 times in a row, not after different ones', function () {
    blockOrder(['product_id' => $this->b->id]);
    blockOrder();
    blockOrder();
    expect(blockedRule())->toBeNull(); // b, a, a
    blockOrder();
    expect(blockedRule())->toBe(AutoBlock::SAME_IN_ROW); // a, a, a
});

it('blocks a store phone after the same cart 3 times in a row, whatever the order of the items', function () {
    blockOrder(['source' => 'store'], [$this->a->id, $this->b->id]);
    blockOrder(['source' => 'store'], [$this->b->id, $this->a->id]);
    expect(blockedRule())->toBeNull();
    blockOrder(['source' => 'store'], [$this->a->id, $this->b->id]);
    expect(blockedRule())->toBe(AutoBlock::SAME_IN_ROW);
});

it('blocks after 5 landing orders or 6 store orders in one day', function () {
    foreach ([$this->a->id, $this->b->id, $this->a->id, $this->b->id] as $id) {
        blockOrder(['product_id' => $id]);
    }
    expect(blockedRule())->toBeNull();
    blockOrder(['product_id' => $this->b->id]);
    expect(blockedRule())->toBe(AutoBlock::PER_DAY);

    asTenant($this->user, fn () => BlockedCustomer::query()->delete());
    asTenant($this->user, fn () => Order::query()->delete());
    foreach (range(1, 5) as $i) {
        blockOrder(['source' => 'store'], [$i % 2 ? $this->a->id : $this->b->id]);
    }
    expect(blockedRule())->toBeNull();
    blockOrder(['source' => 'store'], [$this->b->id]);
    expect(blockedRule())->toBe(AutoBlock::PER_DAY);
});

it('blocks on returns only past the count and above 75 %', function () {
    // 4 returned of 20 (20 %): kept.
    $orders = [];
    foreach (range(1, 20) as $i) {
        $orders[] = asTenant($this->user, fn () => Order::factory()->create(['customer_phone' => PHONE, 'status' => $i <= 4 ? OrderStatus::Delivered : OrderStatus::Delivered, 'created_at' => now()->subDays(30 + $i)]));
    }
    foreach (array_slice($orders, 0, 4) as $order) {
        $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'returned'])->assertOk();
    }
    expect(blockedRule())->toBeNull();

    // A new phone: 3 returned of 4 (75 %) is not more than 75 %; 3 of 3 is.
    asTenant($this->user, fn () => Order::query()->delete());
    $three = array_map(fn ($i) => asTenant($this->user, fn () => Order::factory()->create(['customer_phone' => PHONE, 'status' => OrderStatus::Delivered, 'created_at' => now()->subDays(40 + $i)])), range(1, 4));
    foreach (array_slice($three, 0, 3) as $order) {
        $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'returned'])->assertOk();
    }
    expect(blockedRule())->toBeNull();
    asTenant($this->user, fn () => $three[3]->forceFill(['status' => OrderStatus::Cancelled])->save());
    $fourth = asTenant($this->user, fn () => Order::factory()->create(['customer_phone' => PHONE, 'status' => OrderStatus::Shipped, 'created_at' => now()->subDays(50)]));
    asTenant($this->user, fn () => $fourth->forceFill(['status' => OrderStatus::Cancelled])->save());
    // Cancelled orders do not count: 3 returned of 3.
    $this->postJson("/api/v1/dashboard/orders/{$three[0]->id}/status", ['status' => 'returned'])->assertStatus(422);
    asTenant($this->user, fn () => app(AutoBlock::class)->afterReturn($three[0]->fresh()));
    expect(blockedRule())->toBe(AutoBlock::RETURNS);
});

it('uses the store thresholds for store returns', function () {
    $orders = array_map(fn ($i) => asTenant($this->user, fn () => Order::factory()->create(['customer_phone' => PHONE, 'source' => 'store', 'status' => OrderStatus::Delivered, 'created_at' => now()->subDays(40 + $i)])), range(1, 5));
    foreach (array_slice($orders, 0, 4) as $order) {
        $this->postJson("/api/v1/dashboard/orders/{$order->id}/status", ['status' => 'returned'])->assertOk();
    }
    expect(blockedRule())->toBeNull(); // 4 of 5: under the store's 5 returns
    $this->postJson("/api/v1/dashboard/orders/{$orders[4]->id}/status", ['status' => 'returned'])->assertOk();
    expect(blockedRule())->toBe(AutoBlock::RETURNS);
});

it('never blocks again a customer the merchant cleared, and lists automatic blocks', function () {
    foreach (range(1, 3) as $i) {
        blockOrder();
    }
    $block = asTenant($this->user, fn () => BlockedCustomer::query()->firstOrFail());
    $this->getJson('/api/v1/dashboard/blocked-customers?by=auto')->assertJsonCount(1, 'data')->assertJsonPath('data.0.rule', AutoBlock::SAME_IN_ROW)->assertJsonPath('data.0.customer_id', fn ($id) => $id !== null);
    $this->getJson('/api/v1/dashboard/blocked-customers?by=merchant')->assertJsonCount(0, 'data');

    $this->deleteJson("/api/v1/dashboard/blocked-customers/{$block->id}")->assertNoContent();
    blockOrder();
    blockOrder();
    expect(blockedRule())->toBeNull();

    // Blocking by hand again makes the rules apply again.
    $customer = asTenant($this->user, fn () => Customer::query()->where('phone', PHONE)->firstOrFail());
    $this->postJson("/api/v1/dashboard/customers/{$customer->id}/block", ['blocked' => true])->assertOk()->assertJsonPath('data.block_exempt', false)->assertJsonPath('data.block.rule', null);
});
