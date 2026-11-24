<?php

declare(strict_types=1);

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Analytics\OrderCosts;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\OrderStatus;
use App\Imports\Products\ColumnMapper;
use App\Models\Domain;
use App\Models\Expense;
use App\Models\Identity;
use App\Models\Order;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShippingCompany;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Services\FormToken;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

const PROFIT_HOST = 'profit-shop.localhost';

beforeEach(function () {
    Mail::fake();
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $this->owner = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create(['host' => PROFIT_HOST, 'active_host' => PROFIT_HOST]);
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
});

/** A live store (prepared, design published, switched on). */
function profitStore(): Store
{
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();

    return Store::query()->withoutGlobalScopes()->where('tenant_id', test()->owner->tenant_id)->firstOrFail();
}

function profitCheckout(Store $store, array $items, array $extra = []): TestResponse
{
    return test()->postJson('/api/v1/public/store/orders', array_merge([
        'host' => PROFIT_HOST,
        'items' => $items,
        'customer' => ['name' => 'سارة محمد', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع 9'],
        'form_token' => app(FormToken::class)->issue('store:'.$store->id, time() - 10),
    ], $extra), internalHeaders());
}

/** A store product with a unit cost, a shipping company with real costs, packaging 5: one order of 2 pieces. */
function profitOrder(array $extra = []): Order
{
    $product = test()->postJson('/api/v1/dashboard/products', ['name' => 'قميص', 'price' => 200, 'cost' => 120, 'in_store' => true])->assertCreated()->json('data.id');
    $company = ShippingCompany::query()->withoutGlobalScopes()->value('id') ?? test()->postJson('/api/v1/dashboard/shipping-companies', [
        'name' => 'بوسطة', 'default_fee' => 50, 'default_cost' => 40, 'return_cost' => 30, 'cod_fee_percent' => 2, 'rates' => [],
    ])->assertCreated()->json('data.id');
    test()->putJson('/api/v1/dashboard/profit/settings', ['packaging_cost' => 5])->assertOk();
    $store = Store::query()->withoutGlobalScopes()->where('tenant_id', test()->owner->tenant_id)->first() ?? profitStore();
    $number = profitCheckout($store, [['product_id' => $product, 'quantity' => 2]], ['shipping_company_id' => $company] + $extra)->assertCreated()->json('data.order_number');

    return Order::query()->withoutGlobalScopes()->where('order_number', $number)->firstOrFail();
}

function profitStaff(array $permissions): User
{
    $staff = User::factory()->for(test()->owner->tenant)->create(['role' => 'staff']);
    $staff->givePermissionTo($permissions);
    app('auth')->forgetGuards();
    Sanctum::actingAs($staff->fresh());

    return $staff;
}

it('snapshots the line costs, the real shipping, the COD cut and packaging on a new order', function () {
    $order = profitOrder();

    expect((string) $order->shipping_cost)->toBe('40.00')->and((string) $order->return_cost)->toBe('30.00')
        // 2% of 450 (2 × 200 + 50 shipping), the cash the carrier collects.
        ->and((string) $order->cod_fee)->toBe('9.00')->and((string) $order->packaging_cost)->toBe('5.00')
        ->and(asTenant($this->owner, fn () => (string) $order->items()->value('unit_cost')))->toBe('120.00');

    // A later cost edit never rewrites a past order.
    $productId = asTenant($this->owner, fn () => $order->items()->value('product_id'));
    $this->putJson('/api/v1/dashboard/products/'.$productId, ['name' => 'قميص', 'price' => 200, 'cost' => 150])->assertOk()->assertJsonPath('data.cost', 150);
    expect(asTenant($this->owner, fn () => (string) $order->items()->value('unit_cost')))->toBe('120.00');

    $p = asTenant($this->owner, fn () => app(OrderCosts::class)->profit($order->fresh()));
    expect($p['profit'])->toBe(45000 - 24000 - 4000 - 900 - 500)->and($p['cost_known'])->toBeTrue();
});

it('takes a variant cost first and the quoted fee when the carrier cost is not set', function () {
    $product = asTenant($this->owner, function () {
        $p = Product::factory()->withOption('المقاس', ['M' => '0', 'L' => '0'])->create(['slug' => 'v', 'price' => '100.00', 'cost' => '60.00', 'stock_mode' => 'variant', 'in_store' => true]);
        $m = $p->options()->first()->values()->where('label', 'M')->value('id');
        ProductVariant::query()->create(['product_id' => $p->id, 'combination_key' => (string) $m, 'stock' => 5, 'cost' => '70.00']);

        return $p;
    });
    $company = $this->postJson('/api/v1/dashboard/shipping-companies', ['name' => 'أرامكس', 'default_fee' => 50, 'rates' => []])->assertCreated()->json('data.id');
    [$option, $m] = asTenant($this->owner, fn () => [$product->options()->value('id'), $product->options()->first()->values()->where('label', 'M')->value('id')]);

    $number = profitCheckout(profitStore(), [['product_id' => $product->id, 'quantity' => 1, 'options' => [$option => $m]]], ['shipping_company_id' => $company])->assertCreated()->json('data.order_number');
    $order = Order::query()->withoutGlobalScopes()->where('order_number', $number)->firstOrFail();

    expect(asTenant($this->owner, fn () => (string) $order->items()->value('unit_cost')))->toBe('70.00')
        ->and((string) $order->shipping_cost)->toBe('50.00')->and($order->cod_fee)->toBeNull();
});

it('saves the carrier costs of a shipping company and its governorates', function () {
    $this->postJson('/api/v1/dashboard/shipping-companies', ['name' => 'بوسطة', 'default_fee' => 50, 'cod_fee_percent' => 101, 'rates' => []])->assertStatus(422)->assertJsonValidationErrors('cod_fee_percent');

    $id = $this->postJson('/api/v1/dashboard/shipping-companies', [
        'name' => 'بوسطة', 'default_fee' => 50, 'default_cost' => 35, 'return_cost' => 20, 'cod_fee_percent' => 1.5,
        'rates' => [['governorate' => 'أسوان', 'fee' => null, 'cost' => 60, 'is_available' => true]],
    ])->assertCreated()->assertJsonPath('data.default_cost', 35)->assertJsonPath('data.cod_fee_percent', 1.5)->json('data.id');

    $rates = collect($this->getJson('/api/v1/dashboard/shipping')->json('data.companies.0.rates'))->keyBy('governorate');
    expect($rates['أسوان']['cost'])->toEqual(60)->and($rates['أسوان']['fee'])->toBeNull()->and($rates['القاهرة']['cost'])->toBeNull();
    expect($id)->toBeInt();
});

it('reports actual and expected profit, losses, expenses, products and ROAS', function () {
    $delivered = profitOrder();
    $returned = profitOrder();
    $waiting = profitOrder();
    asTenant($this->owner, function () use ($delivered, $returned) {
        Order::query()->whereKey($delivered->id)->update(['status' => OrderStatus::Delivered->value, 'utm' => json_encode(['source' => 'facebook'])]);
        Order::query()->whereKey($returned->id)->update(['status' => OrderStatus::Returned->value]);
    });
    $today = now('Africa/Cairo')->format('Y-m-d');
    $this->postJson('/api/v1/dashboard/profit/expenses', ['spent_on' => $today, 'kind' => 'ads_facebook', 'amount' => 50, 'note' => 'حملة'])->assertCreated();
    $this->postJson('/api/v1/dashboard/profit/expenses', ['spent_on' => $today, 'kind' => 'rent', 'amount' => 100])->assertCreated();

    $r = $this->getJson('/api/v1/dashboard/profit')->assertOk();
    // Delivered: 450 − 240 − 40 − 9 − 5 = 156. Returned: shipped both ways + packaging = 40 + 30 + 5 lost.
    $r->assertJsonPath('data.actual.orders', 2)->assertJsonPath('data.actual.revenue', 450)->assertJsonPath('data.actual.losses', 75)
        ->assertJsonPath('data.actual.profit', 81)
        ->assertJsonPath('data.expected.orders', 1)->assertJsonPath('data.expected.profit', 156)
        ->assertJsonPath('data.expenses.total', 150)->assertJsonPath('data.net_profit', -69)
        ->assertJsonPath('data.missing_cost_orders', 0)
        ->assertJsonPath('data.products.0.name', 'قميص')->assertJsonPath('data.products.0.units', 2)->assertJsonPath('data.products.0.profit', 160);
    $facebook = collect($r->json('data.sources'))->firstWhere('source', 'facebook');
    expect($facebook['ad_spend'])->toEqual(50)->and($facebook['roas'])->toEqual(9)->and($facebook['orders'])->toBe(1);
    expect($waiting->status)->toBe(OrderStatus::New);

    $this->getJson('/api/v1/dashboard/profit?from=2026-01-10&to=2026-01-01')->assertStatus(422);
});

it('adds, edits, lists and deletes expenses, validated and kept per store', function () {
    $this->postJson('/api/v1/dashboard/profit/expenses', ['spent_on' => '2099-01-01', 'kind' => 'nope', 'amount' => 0])->assertStatus(422)
        ->assertJsonValidationErrors(['spent_on', 'kind', 'amount']);

    $today = now('Africa/Cairo')->format('Y-m-d');
    $id = $this->postJson('/api/v1/dashboard/profit/expenses', ['spent_on' => $today, 'kind' => 'salaries', 'amount' => 3000, 'note' => '<b>منى</b>'])
        ->assertCreated()->assertJsonPath('data.kind_label', 'مرتبات')->assertJsonPath('data.note', 'منى')->json('data.id');
    $this->putJson('/api/v1/dashboard/profit/expenses/'.$id, ['spent_on' => $today, 'kind' => 'salaries', 'amount' => 3500])->assertOk()->assertJsonPath('data.amount', 3500);
    $this->getJson('/api/v1/dashboard/profit/expenses?kind=salaries')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);

    // Another store's expense is not found.
    $other = storeOwnerElsewhere();
    $foreign = asTenant($other, fn () => Expense::query()->create(['spent_on' => $today, 'kind' => 'rent', 'amount' => '10.00'])->id);
    $this->putJson('/api/v1/dashboard/profit/expenses/'.$foreign, ['spent_on' => $today, 'kind' => 'rent', 'amount' => 20])->assertNotFound();
    $this->deleteJson('/api/v1/dashboard/profit/expenses/'.$foreign)->assertNotFound();

    $this->deleteJson('/api/v1/dashboard/profit/expenses/'.$id)->assertNoContent();
    $this->getJson('/api/v1/dashboard/profit/expenses')->assertJsonCount(0, 'data');

    $this->putJson('/api/v1/dashboard/profit/settings', ['packaging_cost' => -1])->assertStatus(422);
    $this->putJson('/api/v1/dashboard/profit/settings', ['packaging_cost' => 7.5])->assertOk()->assertJsonPath('data.packaging_cost', 7.5);

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/profit')->assertUnauthorized();
    $this->postJson('/api/v1/dashboard/profit/expenses', [])->assertUnauthorized();
});

function storeOwnerElsewhere(): User
{
    $tenant = Tenant::factory()->onPlan('pro')->create();

    return User::factory()->for($tenant)->create();
}

it('hides costs and profit from staff without their permissions', function () {
    $order = profitOrder();
    $productId = asTenant($this->owner, fn () => $order->items()->value('product_id'));

    profitStaff(['products.view', 'products.update', 'orders.view']);
    $this->getJson('/api/v1/dashboard/products/'.$productId)->assertOk()->assertJsonMissingPath('data.cost');
    // A cost sent anyway is ignored.
    $this->putJson('/api/v1/dashboard/products/'.$productId, ['name' => 'قميص', 'price' => 210, 'cost' => 1])->assertOk();
    expect(asTenant($this->owner, fn () => (string) Product::query()->find($productId)->cost))->toBe('120.00');
    $this->getJson('/api/v1/dashboard/orders/'.$order->id)->assertOk()->assertJsonMissingPath('data.profit');
    $this->getJson('/api/v1/dashboard/profit')->assertForbidden();

    profitStaff(['profit.view', 'orders.view']);
    $this->getJson('/api/v1/dashboard/profit')->assertOk();
    $this->getJson('/api/v1/dashboard/orders/'.$order->id)->assertOk()->assertJsonPath('data.profit.profit', 156)->assertJsonPath('data.profit.cost_known', true);
    $this->postJson('/api/v1/dashboard/profit/expenses', ['spent_on' => now('Africa/Cairo')->format('Y-m-d'), 'kind' => 'rent', 'amount' => 10])->assertForbidden();
    $this->putJson('/api/v1/dashboard/profit/settings', ['packaging_cost' => 1])->assertForbidden();
});

it('imports the unit cost column', function () {
    $mapper = new ColumnMapper;
    expect($mapper->guess(['اسم المنتج', 'السعر', 'سعر التكلفة', 'Cost per item'])['cost'] ?? null)->toBe(2);
});

it('gives the copilot the profit report and the expenses', function () {
    profitOrder();
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $ctx = new CopilotContext($this->owner->tenant->fresh(), $this->owner, null);
    $run = fn (string $name, array $args) => Tenancy::runAs($this->owner->tenant_id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    $report = $run('run_report', ['report' => 'profit_summary', 'params' => ['preset' => 'last_30_days']]);
    expect($report->failed)->toBeFalse()->and(json_encode($report->data, JSON_UNESCAPED_UNICODE))->toContain('expected');

    $list = $run('find_records', ['resource' => 'expenses']);
    expect($list->failed)->toBeFalse();
});
