<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\Category;
use App\Models\DiscountCode;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingCompany;
use App\Models\ShippingOffer;
use App\Models\ShippingSetting;
use App\Models\Tenant;
use App\Pricing\PriceCalculator;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;

/**
 * Offers, codes and shipping offers that cover all products, some products or categories
 * (a category covers the ones under it), and delivery with several companies.
 */
beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    Tenancy::context()->set($this->tenant->id);
    $this->now = CarbonImmutable::parse('2026-11-20 12:00:00', 'UTC');
    $this->clothes = Category::query()->create(['name' => 'ملابس', 'slug' => 'clothes']);
    $this->shirts = Category::query()->create(['name' => 'قمصان', 'slug' => 'shirts', 'parent_id' => $this->clothes->id, 'depth' => 1]);
    $this->shoes = Category::query()->create(['name' => 'أحذية', 'slug' => 'shoes']);
    $this->shirt = Product::factory()->create(['price' => '200.00']);
    $this->shirt->categories()->attach($this->shirts->id);
    $this->sneaker = Product::factory()->create(['price' => '500.00']);
    $this->sneaker->categories()->attach($this->shoes->id);
    $this->calc = new PriceCalculator;
});

afterEach(fn () => Tenancy::context()->clear());

/** @param array<int, int> $items product id => quantity */
function cart(array $items, ?string $code = null, ?string $governorate = null, ?int $company = null, ?string $phone = null): array
{
    $lines = [];
    foreach ($items as $id => $quantity) {
        $lines[] = ['product' => Product::query()->findOrFail($id), 'quantity' => $quantity, 'options' => []];
    }

    return test()->calc->quoteCart($lines, test()->now, $code, $phone, false, $governorate, $company)->toArray();
}

function shippingOn(string $fee = '50.00'): ShippingCompany
{
    ShippingSetting::query()->create(['enabled' => true]);

    return ShippingCompany::query()->create(['name' => 'بوسطة', 'default_fee' => $fee]);
}

it('applies a category offer to the products under it, and an all-products offer to everything', function () {
    $offer = Offer::factory()->create(['type' => 'percentage', 'value' => 10, 'applies_to' => 'categories']);
    $offer->categories()->attach($this->clothes->id);

    $quote = cart([$this->shirt->id => 1, $this->sneaker->id => 1]);
    expect($quote['lines'][0]['offer_discount'])->toBe(20.0)
        ->and($quote['lines'][1]['offer'])->toBeNull();

    Offer::factory()->create(['type' => 'fixed', 'value' => 30, 'applies_to' => 'all', 'priority' => 5]);
    $quote = cart([$this->shirt->id => 1, $this->sneaker->id => 1]);
    expect($quote['lines'][0]['offer_discount'])->toBe(30.0)->and($quote['lines'][1]['offer_discount'])->toBe(30.0);
});

it('takes a category code off the covered lines only and refuses it without them', function () {
    $code = DiscountCode::factory()->create(['code' => 'SHOES10', 'type' => 'percentage', 'value' => 10, 'applies_to' => 'categories']);
    $code->categories()->attach($this->shoes->id);

    $quote = cart([$this->shirt->id => 1, $this->sneaker->id => 2], 'shoes10');
    expect($quote['code_discount'])->toBe(100.0)->and($quote['total'])->toBe(1100.0);

    expect(cart([$this->shirt->id => 1], 'SHOES10')['code_error'])->toBe(__('pricing.code_wrong_product'));
});

it('checks pieces and first order for a code', function () {
    DiscountCode::factory()->create(['code' => 'THREE', 'type' => 'fixed', 'value' => 50, 'min_quantity' => 3]);
    DiscountCode::factory()->create(['code' => 'FIRST', 'type' => 'fixed', 'value' => 50, 'first_order_only' => true]);

    expect(cart([$this->shirt->id => 2], 'THREE')['code_error'])->toBe(__('pricing.code_min_quantity', ['quantity' => 3]))
        ->and(cart([$this->shirt->id => 3], 'THREE')['code_discount'])->toBe(50.0);

    $phone = '+201012345678';
    expect(cart([$this->shirt->id => 1], 'FIRST', phone: $phone)['code_discount'])->toBe(50.0);
    // A cancelled order does not count; a real one does.
    Order::factory()->create(['customer_phone' => $phone, 'status' => OrderStatus::Cancelled]);
    expect(cart([$this->shirt->id => 1], 'FIRST', phone: $phone)['code_error'])->toBeNull();
    Order::factory()->create(['customer_phone' => $phone, 'status' => OrderStatus::Delivered]);
    expect(cart([$this->shirt->id => 1], 'FIRST', phone: $phone)['code_error'])->toBe(__('pricing.code_first_order'));
});

it('makes delivery free with a free-shipping code, without touching the products', function () {
    shippingOn();
    DiscountCode::factory()->create(['code' => 'SHIPFREE', 'type' => 'free_shipping', 'value' => 0]);

    $quote = cart([$this->shirt->id => 1], 'SHIPFREE', 'القاهرة');
    expect($quote['code_discount'])->toBe(0.0)
        ->and($quote['shipping'])->toBe(0.0)
        ->and($quote['shipping_original'])->toBe(50.0)
        ->and($quote['shipping_free'])->toBeTrue()
        ->and($quote['shipping_by_code'])->toBeTrue()
        ->and($quote['total'])->toBe(200.0);
});

it('gives free shipping for N pieces of a product (and not for fewer)', function () {
    shippingOn();
    $offer = ShippingOffer::query()->create(['name' => 'اشتري 3 قمصان والشحن مجاني', 'benefit' => 'free', 'min_quantity' => 3, 'applies_to' => 'products']);
    $offer->products()->attach($this->shirt->id);

    expect(cart([$this->shirt->id => 2, $this->sneaker->id => 1], governorate: 'القاهرة')['shipping'])->toBe(50.0);
    $quote = cart([$this->shirt->id => 3, $this->sneaker->id => 1], governorate: 'القاهرة');
    expect($quote['shipping'])->toBe(0.0)->and($quote['shipping_offer']['name'])->toBe('اشتري 3 قمصان والشحن مجاني')->and($quote['total'])->toBe(1100.0);
    // Pieces of other products do not count.
    expect(cart([$this->shirt->id => 1, $this->sneaker->id => 5], governorate: 'القاهرة')['shipping'])->toBe(50.0);
});

it('checks the total of the covered category, the governorates, and picks the best shipping offer', function () {
    shippingOn('60.00');
    $shoes = ShippingOffer::query()->create(['name' => 'أحذية فوق 900', 'benefit' => 'discount', 'value' => '20.00', 'min_total' => '900.00', 'applies_to' => 'categories']);
    $shoes->categories()->attach($this->shoes->id);
    ShippingOffer::query()->create(['name' => 'الجيزة بـ 15', 'benefit' => 'flat', 'value' => '15.00', 'applies_to' => 'all', 'governorates' => ['الجيزة']]);
    ShippingOffer::query()->create(['name' => 'منتهي', 'benefit' => 'free', 'applies_to' => 'all', 'ends_at' => '2026-11-01 00:00:00']);

    // 1 pair = 500 → no; 2 pairs = 1000 → 60 − 20.
    expect(cart([$this->sneaker->id => 1, $this->shirt->id => 3], governorate: 'القاهرة')['shipping'])->toBe(60.0)
        ->and(cart([$this->sneaker->id => 2], governorate: 'القاهرة')['shipping'])->toBe(40.0)
        // Giza: both apply, the lower fee wins.
        ->and(cart([$this->sneaker->id => 2], governorate: 'الجيزة')['shipping'])->toBe(15.0)
        ->and(cart([$this->shirt->id => 1], governorate: 'الجيزة')['shipping_offer']['name'])->toBe('الجيزة بـ 15');
});

it('treats shipping on with no active company as off', function () {
    $company = shippingOn();
    $company->update(['is_active' => false]);

    $quote = cart([$this->shirt->id => 1], governorate: 'القاهرة');
    expect($quote['shipping'])->toBeNull()->and($quote['shipping_available'])->toBeTrue()->and($quote['total'])->toBe(200.0);
});
