<?php

declare(strict_types=1);

use App\Actions\Orders\LinkCustomer;
use App\Enums\DomainType;
use App\Enums\OrderStatus;
use App\Models\Domain;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingCompany;
use App\Models\ShippingSetting;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-11-20 10:00:00', 'UTC'));
    $this->user = actingAsOwner();
});

afterEach(fn () => Carbon::setTestNow());

function homeOrder(OrderStatus $status, string $total, string $at, array $extra = []): Order
{
    return asTenant(test()->user, function () use ($status, $total, $at, $extra) {
        $order = Order::factory()->create(['status' => $status, 'total' => $total, 'created_at' => Carbon::parse($at, 'Africa/Cairo')->utc()] + $extra);
        $order->items()->create(['product_id' => null, 'product_name' => $extra['customer_name'] ?? 'ساعة', 'unit_price' => $total, 'quantity' => 2, 'line_total' => $total]);
        app(LinkCustomer::class)->handle($order);

        return $order;
    });
}

it('reports a period against the one before, with the chart and rankings', function () {
    // Period: 2026-11-18 .. 2026-11-20 (3 days); previous: 11-15 .. 11-17.
    homeOrder(OrderStatus::Delivered, '500.00', '2026-11-18 12:00', ['governorate' => 'القاهرة']);
    homeOrder(OrderStatus::Returned, '300.00', '2026-11-19 09:00', ['governorate' => 'الجيزة']);
    homeOrder(OrderStatus::Confirmed, '200.00', '2026-11-20 08:00', ['governorate' => 'القاهرة', 'source' => 'store']);
    homeOrder(OrderStatus::New, '100.00', '2026-11-20 09:00', ['governorate' => 'أسوان']);
    homeOrder(OrderStatus::Fake, '999.00', '2026-11-20 09:30', ['governorate' => 'أسوان']);
    homeOrder(OrderStatus::Delivered, '400.00', '2026-11-16 12:00');
    homeOrder(OrderStatus::Delivered, '50.00', '2026-11-10 12:00'); // outside both

    $res = $this->getJson('/api/v1/dashboard/home?from=2026-11-18&to=2026-11-20')->assertOk();
    $res->assertJsonPath('data.range', ['from' => '2026-11-18', 'to' => '2026-11-20', 'days' => 3, 'previous_from' => '2026-11-15', 'previous_to' => '2026-11-17'])
        ->assertJsonPath('data.kpis.orders', 5)
        ->assertJsonPath('data.kpis.sales', 1100)          // fake left out
        ->assertJsonPath('data.kpis.delivered_sales', 500)
        ->assertJsonPath('data.kpis.average_order', 275)   // 1100 / 4
        ->assertJsonPath('data.kpis.confirmation_rate', 75) // 3 confirmed+ of 4 called (new left out)
        ->assertJsonPath('data.kpis.delivery_rate', 50)
        ->assertJsonPath('data.kpis.return_rate', 50)
        ->assertJsonPath('data.previous.orders', 1)
        ->assertJsonPath('data.previous.sales', 400)
        ->assertJsonCount(3, 'data.chart')
        ->assertJsonPath('data.chart.2', ['date' => '2026-11-20', 'orders' => 3, 'sales' => 300])
        ->assertJsonPath('data.statuses.fake', 1)
        ->assertJsonPath('data.top_governorates.0', ['governorate' => 'القاهرة', 'orders' => 2, 'sales' => 700])
        ->assertJsonPath('data.sources.store.orders', 1)
        ->assertJsonPath('data.top_products.0.units', 8);

    // Default: the last 30 days.
    $this->getJson('/api/v1/dashboard/home')->assertJsonPath('data.range.days', 30)->assertJsonPath('data.range.to', '2026-11-20');
});

it('lists what needs the merchant now', function () {
    homeOrder(OrderStatus::New, '100.00', '2026-11-20 09:00');
    homeOrder(OrderStatus::New, '100.00', '2026-11-20 09:00', ['follow_up_at' => now()->addDay()]);
    homeOrder(OrderStatus::Shipped, '100.00', '2026-11-01 09:00', ['status_changed_at' => now()->subDays(9)]);

    $this->getJson('/api/v1/dashboard/home')->assertJsonPath('data.todo.to_confirm', 1)->assertJsonPath('data.todo.stale_shipments', 1);
});

it('counts the store ready without a custom domain', function () {
    // A plan without the store: products and shipping are the required steps.
    $tenant = Tenant::factory()->onPlan('basic')->create();
    $this->user = User::factory()->for($tenant)->create();
    Sanctum::actingAs($this->user->fresh(['tenant']));

    $this->getJson('/api/v1/dashboard/home')->assertJsonPath('data.setup.done', false)
        ->assertJsonPath('data.setup.steps.0', ['key' => 'product', 'done' => false, 'optional' => false]);

    asTenant($this->user, function () {
        Product::factory()->create();
        ShippingSetting::query()->create(['enabled' => true]);
        ShippingCompany::query()->create(['name' => 'بوسطة', 'default_fee' => '50.00']);
    });
    $steps = collect($this->getJson('/api/v1/dashboard/home')->json('data.setup.steps'))->keyBy('key');
    expect($steps['product']['done'])->toBeTrue()->and($steps['shipping']['done'])->toBeTrue()
        ->and($steps['domain'])->toBe(['key' => 'domain', 'done' => false, 'optional' => true]);

    // The basic plan has no store: shipping and products are all it needs.
    expect($steps->has('store'))->toBeFalse();
    $this->getJson('/api/v1/dashboard/home')->assertJsonPath('data.setup.done', true);

    asTenant($this->user, fn () => Domain::factory()->create(['type' => DomainType::Custom, 'host' => 'shop.example.com']));
    expect(collect($this->getJson('/api/v1/dashboard/home')->json('data.setup.steps'))->firstWhere('key', 'domain')['done'])->toBeTrue();
});

it('validates the period, keeps stores apart and needs a token', function () {
    $this->getJson('/api/v1/dashboard/home?from=2026-11-20&to=2026-11-01')->assertStatus(422)->assertJsonValidationErrors(['from']);
    $this->getJson('/api/v1/dashboard/home?from=2024-01-01&to=2026-11-20')->assertStatus(422)->assertJsonValidationErrors(['from']);
    $this->getJson('/api/v1/dashboard/home?from=20-11-2026')->assertStatus(422)->assertJsonValidationErrors(['from']);

    homeOrder(OrderStatus::Delivered, '500.00', '2026-11-20 09:00');
    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/home')->assertJsonPath('data.kpis.orders', 0)->assertJsonPath('data.latest_orders', []);

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/home')->assertUnauthorized();
});
