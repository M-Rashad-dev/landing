<?php

declare(strict_types=1);

use App\Actions\Orders\LinkCustomer;
use App\Ai\AiClient;
use App\Ai\AiWallets;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Ai\Copilot\Support\Period;
use App\Ai\FakeAiClient;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\OrderStatus;
use App\Models\CopilotExport;
use App\Models\Order;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Carbon::setTestNow(Carbon::parse('2026-11-20 10:00:00', 'UTC'));
    Storage::fake('local');
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->user = User::factory()->for($this->tenant)->create();
    Sanctum::actingAs($this->user->fresh(['tenant']));
});

afterEach(fn () => Carbon::setTestNow());

/** Runs one copilot tool inside the store, as the engine does. */
function readTool(string $name, array $args): array
{
    $ctx = new CopilotContext(test()->tenant, test()->user);
    $result = Tenancy::runAs(test()->tenant->id, fn () => app(CopilotTools::class)->run($name, $args, $ctx));

    return ['data' => $result->data, 'failed' => $result->failed, 'blocks' => $ctx->blocks(), 'json' => $result->toJson()];
}

function readOrder(OrderStatus $status, string $total, string $cairoAt, array $extra = []): Order
{
    return asTenant(test()->tenant->id, function () use ($status, $total, $cairoAt, $extra) {
        $order = Order::factory()->create(['status' => $status, 'total' => $total, 'created_at' => Carbon::parse($cairoAt, 'Africa/Cairo')->utc()] + $extra);
        $order->items()->create(['product_id' => null, 'product_name' => 'ساعة', 'unit_price' => $total, 'quantity' => 1, 'line_total' => $total]);
        app(LinkCustomer::class)->handle($order);

        return $order;
    });
}

it('reports the same sales as the dashboard home', function () {
    readOrder(OrderStatus::Delivered, '500.00', '2026-11-18 12:00', ['governorate' => 'القاهرة']);
    readOrder(OrderStatus::Returned, '300.00', '2026-11-19 09:00', ['governorate' => 'الجيزة']);
    readOrder(OrderStatus::Confirmed, '200.00', '2026-11-20 08:00', ['source' => 'store']);
    readOrder(OrderStatus::Cancelled, '999.00', '2026-11-20 09:00');
    readOrder(OrderStatus::Delivered, '150.00', '2026-11-16 09:00');

    $home = $this->getJson('/api/v1/dashboard/home?from=2026-11-18&to=2026-11-20')->assertOk()->json('data');
    $report = readTool('run_report', ['report' => 'sales_summary', 'params' => ['from' => '2026-11-18', 'to' => '2026-11-20'], 'show' => true]);

    $result = $report['data']['result'];
    expect($report['failed'])->toBeFalse()
        ->and($result['figures'])->toEqual($home['kpis'])
        ->and($result['previous_figures'])->toEqual($home['previous'])
        ->and($result['by_source'])->toEqual($home['sources'])
        ->and($result['figures']['sales'])->toEqual(1000.0)
        ->and($report['blocks'][0])->toMatchArray(['type' => 'table', 'total' => 3, 'export' => ['report' => 'sales_summary', 'params' => ['from' => '2026-11-18', 'to' => '2026-11-20']]]);

    $top = readTool('run_report', ['report' => 'top_products', 'params' => ['from' => '2026-11-18', 'to' => '2026-11-20']])['data']['result']['products'];
    expect(array_column($top, 'units'))->toBe(array_column($home['top_products'], 'units'));
});

it('reports the same store visits and conversion as the analytics page', function () {
    readOrder(OrderStatus::Delivered, '400.00', '2026-11-19 12:00', ['source' => 'store']);
    readOrder(OrderStatus::New, '100.00', '2026-11-20 08:00', ['source' => 'store']);

    $page = $this->getJson('/api/v1/dashboard/store/analytics?from=2026-11-14&to=2026-11-20')->assertOk()->json('data');
    $report = readTool('run_report', ['report' => 'store_traffic', 'params' => ['from' => '2026-11-14', 'to' => '2026-11-20']]);

    expect($report['data']['result']['figures'])->toEqual($page['totals'])
        ->and($report['data']['result']['previous_figures'])->toEqual($page['previous']);
});

it('lists the products running low the way the products page does', function () {
    asTenant($this->tenant->id, function () {
        Product::factory()->create(['name' => 'خلص', 'stock_mode' => 'product', 'stock' => 0]);
        Product::factory()->create(['name' => 'قليل', 'stock_mode' => 'product', 'stock' => 2]);
        Product::factory()->create(['name' => 'كتير', 'stock_mode' => 'product', 'stock' => 50]);
    });

    $result = readTool('run_report', ['report' => 'low_stock'])['data']['result'];

    expect($result['out_of_stock'])->toBe(1)->and($result['low'])->toBe(1)
        ->and(array_column($result['first_out'], 'name'))->toBe(['خلص'])
        ->and(array_column($result['first_low'], 'name'))->toBe(['قليل']);
});

it('finds records with field filters, named filters and sorts, inside this store only', function () {
    asTenant($this->tenant->id, function () {
        Product::factory()->create(['name' => 'حذاء جري', 'price' => '900.00', 'sku' => 'RUN-1']);
        Product::factory()->create(['name' => 'حذاء مشي', 'price' => '400.00']);
        Product::factory()->inactive()->create(['name' => 'شنطة', 'price' => '1200.00']);
    });
    asTenant(createOwner(), fn () => Product::factory()->create(['name' => 'حذاء متجر تاني', 'price' => '5000.00']));

    $found = readTool('find_records', ['resource' => 'products', 'filters' => ['q' => 'حذاء', 'price' => ['gte' => 300]], 'sort' => '-price']);
    expect($found['data']['total'])->toBe(2)
        ->and(array_column($found['data']['rows'], 'name'))->toBe(['حذاء جري', 'حذاء مشي'])
        ->and($found['data']['rows'][0]['price'])->toBe('900.00');

    $inactive = readTool('find_records', ['resource' => 'products', 'filters' => ['status' => 'inactive']]);
    expect(array_column($inactive['data']['rows'], 'name'))->toBe(['شنطة']);

    expect(readTool('find_records', ['resource' => 'products', 'filters' => ['password' => 'x']])['data']['error'])->toContain('is not a filter of products')
        ->and(readTool('find_records', ['resource' => 'products', 'filters' => ['price' => ['contains' => '9']]])['data']['error'])->toContain('doesn\'t work on price')
        ->and(readTool('find_records', ['resource' => 'products', 'sort' => 'description'])['data']['error'])->toContain('sort is one of')
        ->and(readTool('find_records', ['resource' => 'offers', 'sort' => 'value'])['data']['error'])->toContain('Can\'t sort')
        ->and(readTool('find_records', ['resource' => 'users'])['data']['error'])->toContain('Unknown resource');
});

it('filters dates in Cairo days and periods', function () {
    readOrder(OrderStatus::New, '100.00', '2026-11-19 23:30');
    readOrder(OrderStatus::New, '200.00', '2026-11-20 00:30');

    $yesterday = readTool('find_records', ['resource' => 'orders', 'filters' => ['created_at' => 'yesterday']]);
    $today = readTool('find_records', ['resource' => 'orders', 'filters' => ['created_at' => ['eq' => '2026-11-20']]]);

    expect(array_column($yesterday['data']['rows'], 'total'))->toBe(['100.00'])
        ->and(array_column($today['data']['rows'], 'total'))->toBe(['200.00'])
        ->and(Period::preset('this_week')->from->toDateString())->toBe('2026-11-14') // Saturday
        ->and(Period::preset('last_month')->toArray())->toBe(['from' => '2026-10-01', 'to' => '2026-10-31', 'days' => 31]);
});

it('uses the orders page filters, and keeps customers\' details away from the model', function () {
    readOrder(OrderStatus::New, '100.00', '2026-11-20 08:00', ['customer_name' => 'منى أحمد', 'customer_phone' => '+201011112222', 'address' => 'شارع النيل']);
    readOrder(OrderStatus::Confirmed, '700.00', '2026-11-20 09:00', ['customer_name' => 'كريم علي', 'customer_phone' => '+201033334444']);

    $found = readTool('find_records', ['resource' => 'orders', 'filters' => ['status' => ['new', 'confirmed'], 'total' => ['gte' => 500]], 'show' => true]);

    expect($found['data']['total'])->toBe(1)
        ->and($found['data']['rows'][0])->not->toHaveKeys(['customer_name', 'customer_phone', 'address'])
        ->and($found['json'])->not->toContain('1033334444')->not->toContain('كريم')
        // The merchant's own table has them.
        ->and($found['blocks'][0]['rows'][0])->toMatchArray(['customer_name' => 'كريم علي', 'customer_phone' => '+201033334444', 'status' => 'مؤكد']);

    $customers = readTool('find_records', ['resource' => 'customers', 'filters' => ['segment' => 'all']]);
    expect(array_column($customers['data']['rows'], 'name'))->toContain('منى')->not->toContain('منى أحمد')
        ->and($customers['json'])->not->toContain('1011112222');
});

it('builds an Excel file on the server and lets only this store download it for a day', function () {
    asTenant($this->tenant->id, fn () => Product::factory()->create(['name' => '=HYPERLINK("http://evil")', 'price' => '10.00']));

    $made = readTool('export_xlsx', ['resource' => 'products', 'filename' => 'منتجاتي']);
    $block = $made['blocks'][0];

    expect($made['data'])->toMatchArray(['rows' => 1])
        ->and($block['type'])->toBe('export')
        ->and($block['filename'])->toStartWith('منتجاتي-');
    $export = CopilotExport::query()->withoutGlobalScopes()->sole();
    Storage::disk('local')->assertExists($export->path);
    $zip = new ZipArchive;
    $zip->open(Storage::disk('local')->path($export->path));
    $sheet = (string) $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();
    // Text cells only: no formula can run.
    expect($sheet)->toContain('rightToLeft="1"')->toContain('t="inlineStr"')->not->toContain('<f>');

    $download = $this->get("/api/v1/dashboard/ai/copilot/exports/{$block['token']}")->assertOk();
    expect((string) $download->headers->get('Content-Disposition'))->toContain(rawurlencode($export->filename));

    Sanctum::actingAs(createOwner());
    $this->get("/api/v1/dashboard/ai/copilot/exports/{$block['token']}")->assertNotFound();

    Sanctum::actingAs($this->user->fresh(['tenant']));
    $this->travel(CopilotExport::HOURS + 1)->hours();
    $this->get("/api/v1/dashboard/ai/copilot/exports/{$block['token']}")->assertNotFound();
    $this->artisan('copilot:prune')->assertSuccessful();
    expect(CopilotExport::query()->withoutGlobalScopes()->count())->toBe(0);
    Storage::disk('local')->assertMissing($export->path);
});

it('builds the file of a table from its download button', function () {
    readOrder(OrderStatus::Delivered, '500.00', '2026-11-18 12:00');

    $this->postJson('/api/v1/dashboard/ai/copilot/exports', ['source' => ['report' => 'sales_summary', 'params' => ['period' => 'last_7_days']]])
        ->assertOk()->assertJsonPath('data.type', 'export')->assertJsonPath('data.rows', 7);
    $this->postJson('/api/v1/dashboard/ai/copilot/exports', ['source' => ['resource' => 'invoices']])->assertStatus(422)->assertJsonPath('code', 'export_failed');
    $this->postJson('/api/v1/dashboard/ai/copilot/exports', ['source' => []])->assertStatus(422);
});

it('shows a list in the chat when the model asks for it', function () {
    app(AiWallets::class)->credit($this->tenant, 10000, 'topup');
    asTenant($this->tenant->id, fn () => Product::factory()->count(3)->create());
    app(AiClient::class)->answer(FakeAiClient::toolCall('find_records', ['resource' => 'products', 'show' => true]), 'عندك 3 منتجات.');

    $chat = (int) $this->postJson('/api/v1/dashboard/ai/copilot/chat')->json('data.chat.id');
    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => 'وريني منتجاتي'])->assertStatus(202);
    $messages = $this->getJson("/api/v1/dashboard/ai/copilot/chats/{$chat}")->json('data.messages');

    $reply = end($messages);
    expect($reply['text'])->toBe('عندك 3 منتجات.')
        ->and($reply['blocks'][0])->toMatchArray(['type' => 'table', 'title' => 'المنتجات', 'total' => 3, 'link' => '/dashboard/catalog/products'])
        ->and($reply['blocks'][0]['rows'][0])->toHaveKeys(['id', 'name', 'price', '_url']);
    $tools = collect(app(AiClient::class)->chats[0]['options']['tools'])->pluck('function.name')->all();
    expect($tools)->toContain('find_records')->toContain('run_report')->toContain('export_xlsx')->toContain('describe');
});
