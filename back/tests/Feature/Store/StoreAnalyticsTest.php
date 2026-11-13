<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\AbandonedLead;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Product;
use App\Models\StoreStat;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

function analyticsOwner(string $plan = 'pro'): Tenant
{
    $tenant = Tenant::factory()->onPlan($plan)->create();
    Sanctum::actingAs(User::factory()->for($tenant)->create()->fresh(['tenant']));

    return $tenant;
}

/** A store order at a Cairo date-time, with one line, linked to its customer. */
function storeOrder(Customer $customer, string $cairo, string $total, array $extra = []): Order
{
    $order = Order::factory()->create(array_merge([
        'source' => 'store',
        'customer_id' => $customer->id,
        'customer_phone' => $customer->phone,
        'total' => $total,
        'governorate' => 'الجيزة',
        'status' => OrderStatus::New,
        'created_at' => Carbon::parse($cairo, 'Africa/Cairo')->utc(),
    ], $extra));
    $order->items()->create(['product_id' => $extra['product_id'] ?? null, 'product_name' => 'ساعة', 'unit_price' => $total, 'quantity' => 2, 'line_total' => $total]);

    return $order;
}

beforeEach(fn () => Carbon::setTestNow(Carbon::parse('2026-11-10 12:00', 'Africa/Cairo')));
afterEach(fn () => Carbon::setTestNow());

it('reports visits, the purchase steps, orders, sources, devices, customers and hours, against the previous period', function () {
    $tenant = analyticsOwner();
    asTenant($tenant, function () {
        $watch = Product::factory()->create(['name' => 'ساعة']);
        StoreStat::query()->forceCreate(['date' => '2026-11-09', 'source' => 'facebook', 'device' => 'mobile', 'views' => 80, 'product_views' => 40, 'add_to_cart' => 10, 'checkouts' => 5]);
        StoreStat::query()->forceCreate(['date' => '2026-11-10', 'source' => 'direct', 'device' => 'desktop', 'views' => 20, 'product_views' => 10, 'add_to_cart' => 2, 'checkouts' => 1]);
        // The previous period (Nov 8 – Nov 9 for a 2-day range would overlap): Nov 7.
        StoreStat::query()->forceCreate(['date' => '2026-11-07', 'source' => 'direct', 'device' => 'mobile', 'views' => 50, 'product_views' => 5, 'add_to_cart' => 1, 'checkouts' => 1]);

        $old = Customer::query()->create(['phone' => '+201000000001', 'name' => 'قديم', 'first_order_at' => Carbon::parse('2026-10-01')]);
        $new = Customer::query()->create(['phone' => '+201000000002', 'name' => 'جديد', 'first_order_at' => Carbon::parse('2026-11-09 18:00', 'Africa/Cairo')->utc()]);
        storeOrder($old, '2026-11-09 21:30', '300.00', ['utm' => ['source' => 'fb'], 'product_id' => $watch->id, 'status' => OrderStatus::Delivered]);
        storeOrder($new, '2026-11-09 18:00', '100.00', ['utm' => ['referrer' => 'https://www.instagram.com/x']]);
        storeOrder($new, '2026-11-10 09:00', '200.00', ['status' => OrderStatus::Cancelled]);
        storeOrder($old, '2026-11-07 10:00', '50.00');
        // Landing page orders are not the store's.
        storeOrder($old, '2026-11-09 10:00', '999.00', ['source' => 'landing']);

        AbandonedLead::query()->forceCreate(['source' => 'cart', 'cart_token' => str_repeat('c', 20), 'quantity' => 1, 'status' => 'open', 'created_at' => Carbon::parse('2026-11-09 08:00', 'Africa/Cairo')->utc()]);
        $converted = AbandonedLead::query()->forceCreate(['source' => 'store', 'customer_phone' => '+201000000002', 'quantity' => 1, 'status' => 'converted', 'created_at' => Carbon::parse('2026-11-09 17:00', 'Africa/Cairo')->utc()]);
        $converted->forceFill(['order_id' => Order::query()->where('total', '100.00')->value('id')])->save();
    });

    $res = $this->getJson('/api/v1/dashboard/store/analytics?from=2026-11-09&to=2026-11-10')->assertOk()
        ->assertJsonPath('data.range.days', 2)->assertJsonPath('data.range.previous_from', '2026-11-07')->assertJsonPath('data.range.previous_to', '2026-11-08')
        ->assertJsonPath('data.totals.views', 100)->assertJsonPath('data.totals.add_to_cart', 12)->assertJsonPath('data.totals.checkouts', 6)
        ->assertJsonPath('data.totals.orders', 2)->assertJsonPath('data.totals.revenue', 400)->assertJsonPath('data.totals.average_order', 200)
        ->assertJsonPath('data.totals.conversion', 2)->assertJsonPath('data.totals.cart_rate', 12)->assertJsonPath('data.totals.delivered', 1)
        ->assertJsonPath('data.totals.customers', 2)->assertJsonPath('data.totals.new_customers', 1)->assertJsonPath('data.totals.returning_customers', 1)
        ->assertJsonPath('data.totals.abandoned', 2)->assertJsonPath('data.totals.recovered', 1)
        ->assertJsonPath('data.previous.views', 50)->assertJsonPath('data.previous.orders', 1)->assertJsonPath('data.previous.revenue', 50)
        ->assertJsonPath('data.devices.0.views', 80)->assertJsonPath('data.devices.1.views', 20)
        ->assertJsonPath('data.top_products.0.name', 'ساعة')->assertJsonPath('data.governorates.0.orders', 2)
        ->assertJsonPath('data.days.0.orders', 2)->assertJsonPath('data.days.1.orders', 0);

    $sources = collect($res->json('data.sources'))->keyBy('source');
    expect($sources['facebook'])->toMatchArray(['views' => 80, 'orders' => 1, 'revenue' => 300, 'conversion' => 1.25])
        ->and($sources['instagram'])->toMatchArray(['views' => 0, 'orders' => 1])
        ->and($sources['direct']['orders'])->toBe(0)
        ->and($res->json('data.hours.21'))->toBe(1)->and($res->json('data.hours.18'))->toBe(1);
});

it('defaults to the last 30 days and validates the range', function () {
    analyticsOwner();
    $this->getJson('/api/v1/dashboard/store/analytics')->assertOk()->assertJsonPath('data.range.days', 30)->assertJsonPath('data.range.to', '2026-11-10')
        ->assertJsonPath('data.totals.conversion', null)->assertJsonCount(24, 'data.hours');
    $this->getJson('/api/v1/dashboard/store/analytics?from=2026-11-10&to=2026-11-01')->assertStatus(422)->assertJsonValidationErrors('to');
    $this->getJson('/api/v1/dashboard/store/analytics?from=10-11-2026')->assertStatus(422);
});

it('keeps each store to its own numbers, needs the store plan and a token', function () {
    $other = Tenant::factory()->onPlan('pro')->create();
    asTenant($other, fn () => StoreStat::query()->forceCreate(['date' => '2026-11-10', 'source' => 'direct', 'device' => 'mobile', 'views' => 999, 'product_views' => 0, 'add_to_cart' => 0, 'checkouts' => 0]));

    analyticsOwner();
    $this->getJson('/api/v1/dashboard/store/analytics')->assertOk()->assertJsonPath('data.totals.views', 0);

    analyticsOwner('basic');
    $this->getJson('/api/v1/dashboard/store/analytics')->assertForbidden();

    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/store/analytics')->assertUnauthorized();
});
