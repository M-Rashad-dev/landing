<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\LandingPage;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Services\FormToken;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Testing\TestResponse;

const OFFER_SHOP = 'offers.localhost';

beforeEach(function () {
    $this->seed(ThemeSeeder::class);
    $this->owner = createOwner();
    $this->tenant = $this->owner->tenant;
    Domain::factory()->for($this->tenant)->create(['host' => OFFER_SHOP, 'active_host' => OFFER_SHOP]);
    [$this->shoes, $this->socks, $this->sized] = asTenant($this->tenant, fn () => [
        Product::factory()->create(['name' => 'حذاء', 'price' => '1000.00']),
        Product::factory()->create(['name' => 'شراب', 'price' => '80.00']),
        Product::factory()->withOption('المقاس', ['M' => '0'])->create(['name' => 'تيشيرت']),
    ]);
});

function offerPage(bool $picker): LandingPage
{
    return asTenant(test()->tenant, fn () => LandingPage::factory()->withSections([
        LandingPageFactory::section('order_form', [
            'offer_picker' => $picker,
            'fields' => ['name' => ['enabled' => true, 'required' => true], 'phone' => ['enabled' => true, 'required' => true], 'phone2' => ['enabled' => false, 'required' => false], 'governorate' => ['enabled' => false, 'required' => false], 'city' => ['enabled' => false, 'required' => false], 'address' => ['enabled' => false, 'required' => false], 'notes' => ['enabled' => false, 'required' => false]],
            'custom_fields' => [],
        ], true, 'card'),
    ])->published()->create(['slug' => $picker ? 'choose' : 'auto', 'product_id' => test()->shoes->id]));
}

function offers(): array
{
    return asTenant(test()->tenant, function () {
        $percent = Offer::factory()->percentage(20)->forProduct(test()->shoes)->create(['name' => 'اشتري 2 وخد 20%', 'min_quantity' => 2]);
        $buyGet = Offer::factory()->forProduct(test()->shoes)->create(['name' => 'اشتري 5 والسادس مجانًا', 'type' => 'buy_get', 'value' => null, 'min_quantity' => 5, 'free_quantity' => 1]);
        $gift = Offer::factory()->forProduct(test()->shoes)->create(['name' => 'شراب هدية', 'type' => 'gift', 'value' => null, 'gift_product_id' => test()->socks->id, 'priority' => 5]);

        return compact('percent', 'buyGet', 'gift');
    });
}

function offerQuote(string $slug, int $quantity, mixed $offerId = null): TestResponse
{
    return test()->postJson('/api/v1/public/quote', ['host' => OFFER_SHOP, 'slug' => $slug, 'quantity' => $quantity, 'options' => [], 'offer_id' => $offerId], internalHeaders())->assertOk();
}

it('applies the merchant priority automatically, and the cheapest when priorities tie', function () {
    offerPage(false);
    $o = offers();

    // Gift has priority 5: it wins for one pair, with the socks listed as a free gift.
    offerQuote('auto', 1)->assertJsonPath('data.offer.id', $o['gift']->id)->assertJsonPath('data.gift.name', 'شراب')->assertJsonPath('data.total', 1000);

    asTenant($this->tenant, fn () => $o['gift']->update(['priority' => 0]));
    offerQuote('auto', 2)->assertJsonPath('data.offer.id', $o['percent']->id)->assertJsonPath('data.total', 1600);
    // At 6 pairs 20% off (4800) is cheaper than the free pair (5000); a higher priority makes the free pair win.
    offerQuote('auto', 6)->assertJsonPath('data.offer.id', $o['percent']->id)->assertJsonPath('data.total', 4800);
    asTenant($this->tenant, fn () => $o['buyGet']->update(['priority' => 3]));
    offerQuote('auto', 6)->assertJsonPath('data.offer.id', $o['buyGet']->id)->assertJsonPath('data.total', 5000);
    // A choice is ignored when the form does not let customers choose.
    offerQuote('auto', 2, $o['gift']->id)->assertJsonPath('data.offer.id', $o['percent']->id);
});

it('lets the customer choose an offer when the form allows it', function () {
    offerPage(true);
    $o = offers();

    offerQuote('choose', 6, $o['buyGet']->id)->assertJsonPath('data.offer.id', $o['buyGet']->id)->assertJsonPath('data.total', 5000)->assertJsonPath('data.offer.discount', 1000);
    offerQuote('choose', 2, $o['gift']->id)->assertJsonPath('data.offer.id', $o['gift']->id)->assertJsonPath('data.gift.value', 80);
    offerQuote('choose', 1, $o['percent']->id)->assertJsonPath('data.offer', null)->assertJsonPath('data.offer_error', __('pricing.offer_needs_quantity', ['quantity' => 2]));
    offerQuote('choose', 2, 0)->assertJsonPath('data.offer', null)->assertJsonPath('data.total', 2000);
    // No choice sent → automatic.
    offerQuote('choose', 1)->assertJsonPath('data.offer.id', $o['gift']->id);
});

it('adds the gift as a free line of the order', function () {
    $page = offerPage(true);
    $o = offers();

    $this->postJson('/api/v1/public/orders', [
        'host' => OFFER_SHOP, 'slug' => 'choose', 'quantity' => 1, 'options' => [], 'offer_id' => $o['gift']->id,
        'customer' => ['name' => 'كريم', 'phone' => '01001112223'], 'answers' => [],
        'form_token' => app(FormToken::class)->issue($page->id, time() - 10), 'website' => '', 'ip' => '41.9.9.9',
    ], internalHeaders())->assertCreated()->assertJsonPath('data.total', 1000);

    $order = asTenant($this->tenant, fn () => Order::query()->with('items')->latest('id')->first());
    expect((float) $order->total)->toBe(1000.0)
        ->and($order->offer_name)->toBe('شراب هدية')
        ->and($order->items->map(fn ($i) => [$i->product_name, (float) $i->line_total, $i->is_gift])->all())->toBe([['حذاء', 1000.0, false], ['شراب', 0.0, true]]);

    actingAsOwner($this->owner);
    $this->getJson("/api/v1/dashboard/orders/{$order->id}")->assertOk()->assertJsonPath('data.items.1.is_gift', true);
});

it('validates the new offer types', function () {
    actingAsOwner($this->owner);
    $base = ['name' => 'عرض', 'product_ids' => [$this->shoes->id]];

    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'buy_get'])->assertStatus(422)->assertJsonValidationErrors(['min_quantity', 'free_quantity']);
    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'buy_get', 'min_quantity' => 15, 'free_quantity' => 8])->assertStatus(422)->assertJsonPath('errors.free_quantity.0', __('promotions.buy_get_too_many'));
    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'gift'])->assertStatus(422)->assertJsonValidationErrors(['gift_product_id']);
    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'gift', 'gift_product_id' => $this->sized->id])->assertStatus(422)->assertJsonPath('errors.gift_product_id.0', __('promotions.gift_has_options'));

    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'buy_get', 'min_quantity' => 5, 'free_quantity' => 1])->assertCreated()->assertJsonPath('data.min_quantity', 5)->assertJsonPath('data.free_quantity', 1);
    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'gift', 'gift_product_id' => $this->socks->id])->assertCreated()->assertJsonPath('data.gift_product.name', 'شراب');
    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'percentage', 'value' => 20, 'min_quantity' => 2])->assertCreated()->assertJsonPath('data.min_quantity', 2);

    // Gift products from another store are refused.
    $other = asTenant(createOwner()->tenant, fn () => Product::factory()->create());
    $this->postJson('/api/v1/dashboard/offers', $base + ['type' => 'gift', 'gift_product_id' => $other->id])->assertStatus(422)->assertJsonValidationErrors(['gift_product_id']);
});

it('shows offer requirements and gifts on the public page', function () {
    offerPage(false);
    offers();

    $offers = collect($this->getJson('/api/v1/public/pages?host='.OFFER_SHOP.'&slug=auto', internalHeaders())->assertOk()->json('data.offers'))->keyBy('type');
    expect($offers['percentage']['required_quantity'])->toBe(2)
        ->and($offers['buy_get']['required_quantity'])->toBe(6)
        ->and($offers['gift']['gift'])->toBe(['id' => $this->socks->id, 'name' => 'شراب', 'price' => 80]);
});
