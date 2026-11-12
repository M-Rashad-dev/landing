<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\BlockedCustomer;
use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Domain;
use App\Models\LandingPage;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingCompany;
use App\Models\ShippingOffer;
use App\Models\ShippingSetting;
use App\Models\Tenant;
use App\Models\Upsell;
use App\Services\FormToken;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

const SHOP = 'shop.localhost';

beforeEach(function () {
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->create();
    Domain::factory()->for($this->tenant)->create(['host' => SHOP, 'active_host' => SHOP]);
    $this->product = asTenant($this->tenant, fn () => Product::factory()->withOption('المقاس', ['M' => '0', 'XL' => '50'])->create(['name' => 'تيشيرت', 'price' => '300.00']));
    $this->page = shopPage();
});

/** A published page with an order form (props override the default form settings). */
function shopPage(array $formProps = [], array $attributes = []): LandingPage
{
    $props = array_replace_recursive([
        'fields' => [
            'name' => ['enabled' => true, 'required' => true],
            'phone' => ['enabled' => true, 'required' => true],
            'phone2' => ['enabled' => false, 'required' => false],
            'governorate' => ['enabled' => true, 'required' => true],
            'city' => ['enabled' => true, 'required' => false],
            'address' => ['enabled' => true, 'required' => true],
            'notes' => ['enabled' => true, 'required' => false],
        ],
        'custom_fields' => [],
    ], $formProps);

    return asTenant(test()->tenant, fn () => LandingPage::factory()
        ->withSections([
            LandingPageFactory::section('hero', ['title' => 'x'], true, 'split'),
            LandingPageFactory::section('order_form', $props, true, 'card'),
        ])
        ->published()
        ->create(array_merge(['slug' => 'offer', 'product_id' => test()->product->id], $attributes)));
}

function optionValue(string $label): array
{
    $option = test()->product->options()->withoutGlobalScopes()->first();
    $value = $option->values()->withoutGlobalScopes()->where('label', $label)->first();

    return [$option->id => $value->id];
}

function orderPayload(array $overrides = []): array
{
    $payload = array_replace_recursive([
        'host' => SHOP,
        'slug' => 'offer',
        'quantity' => 2,
        'options' => array_key_exists('options', $overrides) ? [] : optionValue('XL'),
        'code' => null,
        'customer' => ['name' => 'أحمد علي', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'شارع النصر 10'],
        'answers' => [],
        'form_token' => app(FormToken::class)->issue(test()->page->id, time() - 10),
        'website' => '',
        'utm' => ['source' => 'facebook', 'campaign' => 'eid'],
        'ip' => '41.10.10.10',
        'user_agent' => 'Mozilla/5.0',
    ], $overrides);
    // Lists are replaced, not merged.
    if (array_key_exists('options', $overrides)) {
        $payload['options'] = $overrides['options'];
    }

    return $payload;
}

function placeOrder(array $overrides = []): TestResponse
{
    return test()->postJson('/api/v1/public/orders', orderPayload($overrides), internalHeaders());
}

it('issues a form token for a published page', function () {
    $token = $this->getJson('/api/v1/public/form-token?host='.SHOP.'&slug=offer', internalHeaders())
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->json('data.token');

    expect(app(FormToken::class)->isValid($token, $this->page->id, time() + 5))->toBeTrue()
        ->and(app(FormToken::class)->isValid($token, $this->page->id + 1, time() + 5))->toBeFalse();
    $this->getJson('/api/v1/public/form-token?host='.SHOP.'&slug=nope', internalHeaders())->assertNotFound();
    $this->getJson('/api/v1/public/form-token?host='.SHOP.'&slug=offer')->assertUnauthorized();
});

it('quotes with the page product only', function () {
    asTenant($this->tenant, fn () => DiscountCode::factory()->percentage(10)->create(['code' => 'EID10']));

    $this->postJson('/api/v1/public/quote', ['host' => SHOP, 'slug' => 'offer', 'quantity' => 2, 'options' => optionValue('XL'), 'code' => 'eid10', 'product_id' => 999], internalHeaders())
        ->assertOk()
        ->assertJsonPath('data.unit_price', 350)
        ->assertJsonPath('data.base_subtotal', 700)
        ->assertJsonPath('data.code.discount', 70)
        ->assertJsonPath('data.total', 630);

    $this->postJson('/api/v1/public/quote', ['host' => SHOP, 'slug' => 'offer', 'quantity' => 1, 'options' => optionValue('M'), 'code' => 'NOPE'], internalHeaders())
        ->assertOk()
        ->assertJsonPath('data.code', null)
        ->assertJsonPath('data.code_error', 'كود الخصم غير صحيح.');
});

it('creates a full order with offer, code, snapshot, log and redemption', function () {
    asTenant($this->tenant, function () {
        Offer::factory()->bundle(2, '600.00')->forProduct($this->product)->create(['name' => 'قطعتين بـ 600']);
        DiscountCode::factory()->fixed('50.00')->create(['code' => 'SAVE50', 'usage_limit' => 5]);
    });

    $response = placeOrder(['code' => 'save50'])->assertCreated();

    // 2 × (300 + 50) = 700; the bundle (600 + 2 × 50 deltas) saves nothing, the code takes 50.
    expect($response->json('data'))->toBe(['order_number' => 1001, 'total' => 650, 'upsell' => null]);

    $order = asTenant($this->tenant, fn () => Order::query()->with(['items', 'logs', 'redemption'])->firstOrFail());
    expect($order->status)->toBe(OrderStatus::New)
        ->and($order->customer_phone)->toBe('+201012345678')
        ->and($order->subtotal)->toBe('700.00')
        ->and($order->code_discount)->toBe('50.00')
        ->and($order->discount_code)->toBe('SAVE50')
        ->and($order->total)->toBe('650.00')
        ->and($order->ip_address)->toBe('41.10.10.10')
        ->and($order->utm)->toBe(['source' => 'facebook', 'campaign' => 'eid'])
        ->and($order->items)->toHaveCount(1)
        ->and($order->items[0]->product_name)->toBe('تيشيرت')
        ->and($order->items[0]->unit_price)->toBe('350.00')
        ->and($order->items[0]->options)->toBe([['option' => 'المقاس', 'value' => 'XL', 'price_delta' => 50]])
        ->and($order->logs)->toHaveCount(1)
        ->and($order->logs[0]->from_status)->toBeNull()
        ->and($order->redemption->amount)->toBe('50.00');
    expect(asTenant($this->tenant, fn () => DiscountCode::query()->first()->used_count))->toBe(1);
});

it('applies the best offer when it is cheaper', function () {
    asTenant($this->tenant, fn () => Offer::factory()->percentage(20)->forProduct($this->product)->create(['name' => 'خصم 20']));

    placeOrder()->assertCreated()->assertJsonPath('data.total', 560);
    $order = asTenant($this->tenant, fn () => Order::query()->first());
    expect($order->offer_name)->toBe('خصم 20')->and($order->offer_discount)->toBe('140.00');
});

it('numbers orders sequentially per tenant', function () {
    foreach (range(1, 3) as $i) {
        placeOrder(['customer' => ['phone' => '0101234567'.$i], 'ip' => "41.0.0.{$i}"])->assertCreated()->assertJsonPath('data.order_number', 1000 + $i);
    }

    // Another tenant starts at 1001 too.
    $other = Tenant::factory()->create();
    Domain::factory()->for($other)->create(['host' => 'other.localhost', 'active_host' => 'other.localhost']);
    $this->product = asTenant($other, fn () => Product::factory()->create());
    $tenant = $this->tenant;
    $this->tenant = $other;
    $this->page = shopPage();
    $this->tenant = $tenant;

    placeOrder(['host' => 'other.localhost', 'options' => [], 'form_token' => app(FormToken::class)->issue($this->page->id, time() - 10)])
        ->assertCreated()
        ->assertJsonPath('data.order_number', 1001);
});

it('rejects bots with the generic answer', function (string $case) {
    $payload = match ($case) {
        'honeypot' => ['website' => 'http://spam.example'],
        'missing token' => ['form_token' => null],
        'fresh token' => ['form_token' => app(FormToken::class)->issue(test()->page->id, time())],
        'expired token' => ['form_token' => app(FormToken::class)->issue(test()->page->id, time() - 7201)],
        'forged token' => ['form_token' => (time() - 10).'.'.str_repeat('a', 64)],
        'token of another page' => ['form_token' => app(FormToken::class)->issue(test()->page->id + 50, time() - 10)],
    };

    placeOrder($payload)->assertStatus(422)->assertJsonPath('code', 'rejected')->assertJsonPath('message', 'تعذر إتمام الطلب. حاول مرة أخرى لاحقًا.');
    expect(asTenant($this->tenant, fn () => Order::query()->count()))->toBe(0);
})->with(['honeypot', 'missing token', 'fresh token', 'expired token', 'forged token', 'token of another page']);

it('rejects blocked phones and IPs', function () {
    asTenant($this->tenant, fn () => BlockedCustomer::query()->create(['type' => 'phone', 'value' => '+201012345678']));
    placeOrder()->assertStatus(422)->assertJsonPath('code', 'rejected');

    asTenant($this->tenant, fn () => BlockedCustomer::query()->create(['type' => 'ip', 'value' => '41.9.9.9']));
    placeOrder(['customer' => ['phone' => '01099999999'], 'ip' => '41.9.9.9'])->assertStatus(422)->assertJsonPath('code', 'rejected');

    placeOrder(['customer' => ['phone' => '01099999999']])->assertCreated();
});

it('limits orders per IP and per phone', function () {
    foreach (range(1, 5) as $i) {
        placeOrder(['customer' => ['phone' => '0111111111'.$i]])->assertCreated();
    }
    placeOrder(['customer' => ['phone' => '01122222222']])->assertStatus(429)->assertJsonPath('code', 'rejected');

    foreach (range(1, 3) as $i) {
        placeOrder(['customer' => ['phone' => '01233333333'], 'ip' => "41.1.1.{$i}"])->assertCreated();
    }
    placeOrder(['customer' => ['phone' => '01233333333'], 'ip' => '41.1.1.9'])->assertStatus(429);
});

it('needs a published page, an active product and a visible form', function () {
    placeOrder(['host' => 'nobody.localhost'])->assertNotFound();
    placeOrder(['slug' => 'missing'])->assertNotFound();

    asTenant($this->tenant, fn () => LandingPage::factory()->create(['slug' => 'draft', 'product_id' => $this->product->id]));
    placeOrder(['slug' => 'draft'])->assertNotFound();

    asTenant($this->tenant, fn () => $this->product->update(['is_active' => false]));
    placeOrder()->assertStatus(422)->assertJsonPath('code', 'product_unavailable');
    asTenant($this->tenant, fn () => $this->product->update(['is_active' => true]));

    asTenant($this->tenant, fn () => LandingPage::factory()
        ->withSections([LandingPageFactory::section('order_form', [], false, 'card')])
        ->published()->create(['slug' => 'hidden-form', 'product_id' => $this->product->id]));
    placeOrder(['slug' => 'hidden-form'])->assertStatus(422)->assertJsonPath('code', 'form_unavailable');

    $this->tenant->update(['status' => 'suspended']);
    placeOrder()->assertNotFound();
});

it('validates the form from the published settings', function () {
    placeOrder(['customer' => ['name' => 'أ', 'phone' => '0123', 'governorate' => 'باريس', 'address' => '']])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['customer.name', 'customer.phone', 'customer.governorate', 'customer.address']);

    // A disabled built-in field is refused, unknown keys are ignored.
    placeOrder(['customer' => ['phone2' => '01111111111', 'nickname' => 'x']])->assertStatus(422)->assertJsonValidationErrors(['customer.phone2']);
    placeOrder(['customer' => ['nickname' => 'x']])->assertCreated();

    // Options and quantity come back on their own keys.
    placeOrder(['options' => [], 'customer' => ['phone' => '01500000000'], 'ip' => '41.2.2.2'])->assertStatus(422)->assertJsonValidationErrors(['options.'.array_key_first(optionValue('M'))]);
    placeOrder(['quantity' => 21])->assertStatus(422)->assertJsonValidationErrors(['quantity']);
});

it('requires optional fields when the seller makes them required', function () {
    $this->page = shopPage(['fields' => ['phone2' => ['enabled' => true, 'required' => true], 'address' => ['enabled' => false]]], ['slug' => 'strict']);

    placeOrder(['slug' => 'strict', 'customer' => ['address' => null]])->assertStatus(422)->assertJsonValidationErrors(['customer.phone2']);
    placeOrder(['slug' => 'strict', 'customer' => ['address' => null, 'phone2' => '٠١١٢٣٤٥٦٧٨٩']])->assertCreated();
    expect(asTenant($this->tenant, fn () => Order::query()->first()->customer_phone2))->toBe('+201123456789');
});

it('uses the default form fields when the section has no fields prop', function () {
    $this->page = asTenant($this->tenant, fn () => LandingPage::factory()
        ->withSections([LandingPageFactory::section('order_form', [], true, 'card')])
        ->published()
        ->create(['slug' => 'bare', 'product_id' => $this->product->id]));

    placeOrder(['slug' => 'bare', 'customer' => ['address' => '']])->assertStatus(422)->assertJsonValidationErrors(['customer.address']);
    placeOrder(['slug' => 'bare', 'customer' => ['phone2' => '01111111111']])->assertStatus(422)->assertJsonValidationErrors(['customer.phone2']);
    placeOrder(['slug' => 'bare', 'customer' => ['city' => 'مدينة نصر', 'notes' => 'بعد العصر']])->assertCreated();
});

it('validates and snapshots custom answers, ignoring unknown ones', function () {
    $this->page = shopPage(['custom_fields' => [
        ['key' => 'size_note', 'label' => 'ملاحظة المقاس', 'type' => 'text', 'required' => true, 'choices' => []],
        ['key' => 'color', 'label' => 'اللون', 'type' => 'select', 'required' => false, 'choices' => ['أحمر', 'أزرق']],
        ['key' => 'age', 'label' => 'السن', 'type' => 'number', 'required' => false, 'choices' => []],
        ['key' => 'gift', 'label' => 'هدية؟', 'type' => 'checkbox', 'required' => false, 'choices' => []],
        ['key' => 'when', 'label' => 'موعد التوصيل', 'type' => 'date', 'required' => false, 'choices' => []],
    ]], ['slug' => 'custom']);

    placeOrder(['slug' => 'custom', 'answers' => ['color' => 'أخضر', 'age' => 'abc', 'when' => '2026-13-40']])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['answers.size_note', 'answers.color', 'answers.age', 'answers.when']);

    placeOrder(['slug' => 'custom', 'answers' => ['size_note' => '<b>واسع</b>', 'color' => 'أزرق', 'age' => '30', 'gift' => true, 'when' => '2026-11-01', 'hacker' => 'x']])->assertCreated();

    expect(asTenant($this->tenant, fn () => Order::query()->first()->answers))->toBe([
        ['key' => 'size_note', 'label' => 'ملاحظة المقاس', 'type' => 'text', 'value' => 'واسع'],
        ['key' => 'color', 'label' => 'اللون', 'type' => 'select', 'value' => 'أزرق'],
        ['key' => 'age', 'label' => 'السن', 'type' => 'number', 'value' => 30],
        ['key' => 'gift', 'label' => 'هدية؟', 'type' => 'checkbox', 'value' => true],
        ['key' => 'when', 'label' => 'موعد التوصيل', 'type' => 'date', 'value' => '2026-11-01'],
    ]);
});

it('fails the order on an invalid code', function () {
    placeOrder(['code' => 'NOPE'])->assertStatus(422)->assertJsonValidationErrors(['code']);
});

it('never lets a limited code go over its limit', function () {
    asTenant($this->tenant, fn () => DiscountCode::factory()->fixed('10.00')->create(['code' => 'TWO', 'usage_limit' => 2]));

    $results = collect(range(1, 5))->map(fn (int $i) => placeOrder([
        'code' => 'TWO',
        'customer' => ['phone' => '0100000000'.$i],
        'ip' => "41.3.3.{$i}",
    ])->status());

    expect($results->filter(fn ($s) => $s === 201))->toHaveCount(2)
        ->and($results->filter(fn ($s) => $s === 422))->toHaveCount(3)
        ->and(asTenant($this->tenant, fn () => DiscountCode::query()->first()->used_count))->toBe(2)
        ->and(asTenant($this->tenant, fn () => DiscountCodeRedemption::query()->count()))->toBe(2);
});

it('flags possible duplicates but accepts them', function () {
    placeOrder()->assertCreated();
    placeOrder(['ip' => '41.4.4.4'])->assertCreated();

    $orders = asTenant($this->tenant, fn () => Order::query()->orderBy('id')->get());
    expect($orders[0]->is_duplicate_suspect)->toBeFalse()->and($orders[1]->is_duplicate_suspect)->toBeTrue();

    // A cancelled earlier order does not count.
    asTenant($this->tenant, fn () => Order::query()->update(['status' => OrderStatus::Cancelled]));
    placeOrder(['ip' => '41.4.4.5'])->assertCreated();
    expect(asTenant($this->tenant, fn () => Order::query()->latest('id')->first()->is_duplicate_suspect))->toBeFalse();
});

it('returns the same order for a repeated idempotency key', function () {
    $key = (string) Str::uuid();

    $first = placeOrder(['idempotency_key' => $key])->assertCreated()->json('data');
    $second = placeOrder(['idempotency_key' => $key])->assertCreated()->json('data');

    expect($second)->toBe($first)->and(asTenant($this->tenant, fn () => Order::query()->count()))->toBe(1);
});

it('accepts only a valid client IP', function () {
    placeOrder(['ip' => 'not-an-ip'])->assertStatus(422)->assertJsonValidationErrors(['ip']);
});

it('adds the delivery fee for the governorate, free above the threshold, and refuses closed governorates', function () {
    asTenant($this->tenant, function () {
        ShippingSetting::query()->create(['enabled' => true]);
        $company = ShippingCompany::query()->create(['name' => 'بوسطة', 'default_fee' => '50.00']);
        $company->rates()->create(['governorate' => 'أسوان', 'fee' => '90.00', 'is_available' => true]);
        $company->rates()->create(['governorate' => 'شمال سيناء', 'fee' => null, 'is_available' => false]);
        ShippingOffer::query()->create(['name' => 'شحن مجاني فوق 1000', 'benefit' => 'free', 'min_total' => '1000.00', 'applies_to' => 'all']);
    });
    $quote = fn (array $extra) => $this->postJson('/api/v1/public/quote', array_merge(['host' => SHOP, 'slug' => 'offer', 'quantity' => 1, 'options' => optionValue('M')], $extra), internalHeaders());

    // Not chosen yet → no fee in the total; default; custom; free over 1000; closed.
    $quote([])->assertOk()->assertJsonPath('data.shipping', null)->assertJsonPath('data.total', 300);
    $quote(['governorate' => 'القاهرة'])->assertJsonPath('data.shipping', 50)->assertJsonPath('data.items_total', 300)->assertJsonPath('data.total', 350);
    $quote(['governorate' => 'أسوان'])->assertJsonPath('data.shipping', 90)->assertJsonPath('data.total', 390);
    $quote(['governorate' => 'أسوان', 'quantity' => 4])->assertJsonPath('data.shipping', 0)->assertJsonPath('data.shipping_free', true)->assertJsonPath('data.total', 1200);
    $quote(['governorate' => 'شمال سيناء'])->assertJsonPath('data.shipping_available', false);

    // The order stores the fee inside the total.
    placeOrder(['quantity' => 1, 'options' => optionValue('M'), 'customer' => ['governorate' => 'أسوان']])->assertCreated()->assertJsonPath('data.total', 390);
    $order = asTenant($this->tenant, fn () => Order::query()->latest('id')->first());
    expect((string) $order->shipping_fee)->toBe('90.00')->and((string) $order->total)->toBe('390.00')
        ->and($order->shipping_company_name)->toBe('بوسطة')->and($order->shipping_offer_name)->toBeNull();

    placeOrder(['customer' => ['phone' => '01022223333', 'governorate' => 'شمال سيناء'], 'ip' => '41.9.9.1'])->assertStatus(422)->assertJsonValidationErrors(['customer.governorate']);

    // The public page tells the form the fees.
    $this->getJson('/api/v1/public/pages?host='.SHOP.'&slug=offer', internalHeaders())
        ->assertJsonPath('data.shipping.enabled', true)
        ->assertJsonPath('data.shipping.fees.أسوان', 90)
        ->assertJsonPath('data.shipping.unavailable', ['شمال سيناء'])
        ->assertJsonPath('data.shipping.free_over', 1000);
});

it('lets the customer choose the company, keeps the choice and the shipping offer on the order', function () {
    [$fast, $cheap] = asTenant($this->tenant, function () {
        ShippingSetting::query()->create(['enabled' => true]);
        $fast = ShippingCompany::query()->create(['name' => 'سريع', 'default_fee' => '80.00', 'delivery_days_min' => 1, 'delivery_days_max' => 2, 'position' => 0]);
        $cheap = ShippingCompany::query()->create(['name' => 'اقتصادي', 'default_fee' => '40.00', 'position' => 1]);
        $cheap->rates()->create(['governorate' => 'أسوان', 'fee' => null, 'is_available' => false]);
        // Two pieces of this product → the fast company costs 30.
        $offer = ShippingOffer::query()->create(['name' => 'قطعتين والسريع بـ 30', 'benefit' => 'flat', 'value' => '30.00', 'min_quantity' => 2, 'applies_to' => 'products', 'company_ids' => [$fast->id]]);
        $offer->products()->attach($this->product->id);

        return [$fast, $cheap];
    });
    $quote = fn (array $extra) => $this->postJson('/api/v1/public/quote', array_merge(['host' => SHOP, 'slug' => 'offer', 'quantity' => 1, 'options' => optionValue('M'), 'governorate' => 'القاهرة'], $extra), internalHeaders());

    // Not chosen → the cheapest; both listed with their fees and days.
    $quote([])->assertOk()->assertJsonPath('data.shipping', 40)->assertJsonPath('data.shipping_company.name', 'اقتصادي')
        ->assertJsonCount(2, 'data.shipping_options')->assertJsonPath('data.shipping_options.0.days_max', 2);
    $quote(['shipping_company_id' => $fast->id])->assertJsonPath('data.shipping', 80);
    // The offer makes the fast one 30 for two pieces, and the cheapest wins on its own.
    $quote(['quantity' => 2])->assertJsonPath('data.shipping', 30)->assertJsonPath('data.shipping_original', 80)
        ->assertJsonPath('data.shipping_offer.name', 'قطعتين والسريع بـ 30')->assertJsonPath('data.shipping_company.id', $fast->id);
    // Aswan: only the fast company.
    $quote(['governorate' => 'أسوان'])->assertJsonCount(1, 'data.shipping_options')->assertJsonPath('data.shipping', 80);

    placeOrder(['shipping_company_id' => $cheap->id, 'customer' => ['governorate' => 'أسوان']])->assertStatus(422)->assertJsonValidationErrors(['shipping_company_id']);
    placeOrder(['quantity' => 2, 'shipping_company_id' => $fast->id])->assertCreated()->assertJsonPath('data.total', 730);
    $order = asTenant($this->tenant, fn () => Order::query()->latest('id')->first());
    expect($order->shipping_company_id)->toBe($fast->id)->and($order->shipping_company_name)->toBe('سريع')
        ->and($order->shipping_offer_name)->toBe('قطعتين والسريع بـ 30')->and((string) $order->shipping_discount)->toBe('50.00')
        ->and((string) $order->shipping_fee)->toBe('30.00');

    $this->getJson('/api/v1/public/pages?host='.SHOP.'&slug=offer', internalHeaders())
        ->assertJsonPath('data.shipping.fees.القاهرة', 40)
        ->assertJsonPath('data.shipping.fees.أسوان', 80)
        ->assertJsonCount(2, 'data.shipping.companies')
        ->assertJsonPath('data.shipping.offers.0.min_quantity', 2);
});

it('charges nothing for delivery while shipping is off', function () {
    placeOrder()->assertCreated();
    expect((string) asTenant($this->tenant, fn () => Order::query()->latest('id')->value('shipping_fee')))->toBe('0.00');
    $this->getJson('/api/v1/public/pages?host='.SHOP.'&slug=offer', internalHeaders())->assertJsonPath('data.shipping', ['enabled' => false]);
});

it('offers a post-order upsell and adds it to the order in one click, once, within 30 minutes', function () {
    placeOrder()->assertCreated()->assertJsonPath('data.upsell', null);

    [$strap, $sized] = asTenant($this->tenant, function () {
        $strap = Product::factory()->create(['name' => 'حزام إضافي', 'price' => '150.00']);
        $sized = Product::factory()->withOption('المقاس', ['S' => '0'])->create(['name' => 'منتج بمقاسات']);
        // A product with a required choice is never offered (one click, no choosing).
        Upsell::query()->create(['name' => 'مقاسات', 'trigger_product_id' => $this->product->id, 'offer_product_id' => $sized->id, 'price' => '50.00', 'headline' => 'x', 'priority' => 9]);
        Upsell::query()->create(['name' => 'حزام', 'trigger_product_id' => $this->product->id, 'offer_product_id' => $strap->id, 'price' => '99.00', 'headline' => 'زوّد حزام بسعر خاص']);

        return [$strap, $sized];
    });

    $created = placeOrder(['customer' => ['phone' => '01033334444'], 'ip' => '41.7.7.7'])->assertCreated();
    $created->assertJsonPath('data.upsell.headline', 'زوّد حزام بسعر خاص')
        ->assertJsonPath('data.upsell.price', 99)
        ->assertJsonPath('data.upsell.regular_price', 150)
        ->assertJsonPath('data.upsell.product.name', 'حزام إضافي');
    $offer = $created->json('data.upsell');
    $number = $created->json('data.order_number');
    $accept = fn (array $extra = []) => $this->postJson('/api/v1/public/upsell', array_merge(['host' => SHOP, 'order_number' => $number, 'upsell_id' => $offer['id'], 'token' => $offer['token']], $extra), internalHeaders());

    $accept(['token' => str_repeat('a', 64)])->assertStatus(422)->assertJsonPath('code', 'upsell_closed');
    $accept()->assertOk()->assertJsonPath('data.total', $created->json('data.total') + 99);
    $accept()->assertStatus(422);

    $order = asTenant($this->tenant, fn () => Order::query()->with('items')->where('order_number', $number)->first());
    expect($order->items)->toHaveCount(2)
        ->and($order->items->last()->product_id)->toBe($strap->id)
        ->and((string) $order->items->last()->line_total)->toBe('99.00');
    expect($sized->id)->not->toBe($strap->id);

    // Too late, or no longer new.
    $late = placeOrder(['customer' => ['phone' => '01044445555'], 'ip' => '41.7.7.8'])->json('data');
    $this->travel(31)->minutes();
    $this->postJson('/api/v1/public/upsell', ['host' => SHOP, 'order_number' => $late['order_number'], 'upsell_id' => $late['upsell']['id'], 'token' => $late['upsell']['token']], internalHeaders())->assertStatus(422);
});
