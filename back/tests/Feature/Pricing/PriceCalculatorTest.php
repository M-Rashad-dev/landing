<?php

declare(strict_types=1);

use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Offer;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\Tenant;
use App\Pricing\PriceCalculator;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    $this->tenant = Tenant::factory()->create();
    Tenancy::context()->set($this->tenant->id);
    $this->now = CarbonImmutable::parse('2026-11-10 12:00:00', 'UTC');
    $this->product = Product::factory()
        ->withOption('المقاس', ['S' => '0', 'XL' => '25'])
        ->withOption('تغليف هدية', ['نعم' => '10'], required: false)
        ->create(['price' => '350.00']);
    $this->size = ProductOption::query()->where('name', 'المقاس')->firstOrFail();
    $this->small = ProductOptionValue::query()->where('label', 'S')->firstOrFail();
    $this->xl = ProductOptionValue::query()->where('label', 'XL')->firstOrFail();
    $this->gift = ProductOptionValue::query()->where('label', 'نعم')->firstOrFail();
    $this->calc = new PriceCalculator;
});

afterEach(fn () => Tenancy::context()->clear());

function quote(array $options = [], int $qty = 1, ?string $code = null, ?string $phone = null, ?CarbonImmutable $at = null): array
{
    $test = test();
    $options = $options ?: [$test->size->id => $test->small->id];

    return $test->calc->quote($test->product->fresh(), $qty, $options, $at ?? $test->now, $code, $phone)->toArray();
}

function offerFor(Product $product, array $attributes = []): Offer
{
    $offer = Offer::factory()->create($attributes);
    $offer->products()->attach($product->id, ['tenant_id' => $product->tenant_id]);

    return $offer;
}

it('prices a single unit without offers', function () {
    expect(quote())->toMatchArray([
        'currency' => 'EGP', 'unit_price' => 350.0, 'quantity' => 1, 'base_subtotal' => 350.0,
        'offer' => null, 'subtotal_after_offer' => 350.0, 'code' => null, 'code_error' => null, 'total' => 350.0,
    ]);
});

it('adds option deltas to the unit price', function () {
    $q = quote([$this->size->id => $this->xl->id, $this->gift->option_id => $this->gift->id], 2);

    expect($q['unit_price'])->toBe(385.0)->and($q['base_subtotal'])->toBe(770.0)->and($q['total'])->toBe(770.0);
});

it('requires every required option', function () {
    $this->calc->quote($this->product->fresh(), 1, [], $this->now);
})->throws(ValidationException::class);

it('reports option errors on options.{id}', function () {
    try {
        $this->calc->quote($this->product->fresh(), 1, [$this->size->id => $this->gift->id], $this->now);
        $this->fail('expected validation error');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey("options.{$this->size->id}");
    }
});

it('rejects inactive values', function () {
    $this->xl->update(['is_active' => false]);

    $this->calc->quote($this->product->fresh(), 1, [$this->size->id => $this->xl->id], $this->now);
})->throws(ValidationException::class);

it('rejects quantities outside 1..20', function (int $qty) {
    $this->calc->quote($this->product->fresh(), $qty, [$this->size->id => $this->small->id], $this->now);
})->with([0, 21])->throws(ValidationException::class);

it('applies a percentage offer', function () {
    $offer = offerFor($this->product, ['type' => 'percentage', 'value' => '20.00', 'name' => 'خصم 20']);

    expect(quote(qty: 2))->toMatchArray([
        'base_subtotal' => 700.0,
        'offer' => ['id' => $offer->id, 'name' => 'خصم 20', 'type' => 'percentage', 'discount' => 140.0],
        'subtotal_after_offer' => 560.0,
        'total' => 560.0,
    ]);
});

it('applies a fixed per-unit offer', function () {
    offerFor($this->product, ['type' => 'fixed', 'value' => '50.00']);

    expect(quote(qty: 3)['subtotal_after_offer'])->toBe(900.0);
});

it('applies a bundle with remainder and option deltas', function () {
    offerFor($this->product, ['type' => 'bundle', 'value' => null, 'bundle_quantity' => 2, 'bundle_price' => '600.00']);

    // 3 × XL: one bundle (600) + one single (350) + deltas 3 × 25
    $q = quote([$this->size->id => $this->xl->id], 3);
    expect($q['base_subtotal'])->toBe(1125.0)
        ->and($q['subtotal_after_offer'])->toBe(1025.0)
        ->and($q['offer']['discount'])->toBe(100.0);

    // Below the bundle quantity it does not apply.
    expect(quote()['offer'])->toBeNull();
});

it('chooses the best offer and never stacks two offers', function () {
    offerFor($this->product, ['type' => 'percentage', 'value' => '10.00']);
    $best = offerFor($this->product, ['type' => 'bundle', 'value' => null, 'bundle_quantity' => 2, 'bundle_price' => '500.00']);
    offerFor($this->product, ['type' => 'fixed', 'value' => '20.00']);

    $q = quote(qty: 2);
    expect($q['offer']['id'])->toBe($best->id)->and($q['subtotal_after_offer'])->toBe(500.0);
});

it('breaks ties by priority then by the oldest offer', function () {
    $older = offerFor($this->product, ['type' => 'fixed', 'value' => '50.00', 'priority' => 1]);
    offerFor($this->product, ['type' => 'fixed', 'value' => '50.00', 'priority' => 1]);
    expect(quote()['offer']['id'])->toBe($older->id);

    $important = offerFor($this->product, ['type' => 'percentage', 'value' => '50.00', 'priority' => 5]);
    offerFor($this->product, ['type' => 'fixed', 'value' => '175.00', 'priority' => 2]);
    expect(quote()['offer']['id'])->toBe($important->id);
});

it('ignores offers of other products, inactive and outside their window', function () {
    $other = Product::factory()->create();
    offerFor($other, ['type' => 'percentage', 'value' => '50.00']);
    offerFor($this->product, ['type' => 'percentage', 'value' => '50.00', 'is_active' => false]);
    offerFor($this->product, ['type' => 'percentage', 'value' => '50.00', 'starts_at' => $this->now->addSecond()]);
    offerFor($this->product, ['type' => 'percentage', 'value' => '50.00', 'ends_at' => $this->now->subSecond()]);

    expect(quote()['offer'])->toBeNull();
});

it('treats both window bounds as inclusive', function () {
    $start = $this->now;
    $end = $this->now->addDay();
    offerFor($this->product, ['type' => 'percentage', 'value' => '10.00', 'starts_at' => $start, 'ends_at' => $end]);

    expect(quote(at: $start)['offer'])->not->toBeNull()
        ->and(quote(at: $end)['offer'])->not->toBeNull()
        ->and(quote(at: $start->subSecond())['offer'])->toBeNull()
        ->and(quote(at: $end->addSecond())['offer'])->toBeNull();
});

it('ignores a bundle that is no longer profitable after a price change', function () {
    offerFor($this->product, ['type' => 'bundle', 'value' => null, 'bundle_quantity' => 2, 'bundle_price' => '600.00']);
    $this->product->update(['price' => '300.00']);

    expect(quote(qty: 2)['offer'])->toBeNull();
});

it('applies a percentage code with a cap on top of an offer', function () {
    offerFor($this->product, ['type' => 'bundle', 'value' => null, 'bundle_quantity' => 2, 'bundle_price' => '600.00']);
    DiscountCode::factory()->percentage(25, '100.00')->create(['code' => 'EID25']);

    $q = quote(qty: 2, code: 'eid25');
    expect($q['subtotal_after_offer'])->toBe(600.0)
        ->and($q['code'])->toBe(['code' => 'EID25', 'discount' => 100.0])
        ->and($q['total'])->toBe(500.0);
});

it('applies a fixed code and never goes below zero', function () {
    DiscountCode::factory()->fixed('1000.00')->create(['code' => 'BIG']);

    expect(quote(code: 'BIG'))->toMatchArray(['code' => ['code' => 'BIG', 'discount' => 350.0], 'total' => 0.0]);
});

it('rounds code percentages half up', function () {
    $this->product->update(['price' => '33.33']);
    DiscountCode::factory()->percentage(15)->create(['code' => 'R15']);

    // 15% of 33.33 = 4.9995 → 5.00
    expect(quote(code: 'R15')['code']['discount'])->toBe(5.0);
});

it('returns the first failing code rule with an arabic message', function (string $case, string $expected) {
    $code = fn (array $attributes = []) => DiscountCode::factory()->create(['code' => 'TEST'] + $attributes);

    match ($case) {
        'missing' => null,
        'inactive' => $code(['is_active' => false]),
        'not started' => $code(['starts_at' => $this->now->addMinute()]),
        'expired' => $code(['ends_at' => $this->now->subMinute()]),
        'other product' => $code()->products()->attach(Product::factory()->create()->id, ['tenant_id' => $this->tenant->id]),
        'used up' => $code(['usage_limit' => 2, 'used_count' => 2]),
        'phone limit' => DiscountCodeRedemption::create([
            'discount_code_id' => $code(['usage_limit_per_phone' => 1])->id,
            'order_id' => 1, 'phone' => '+201012345678', 'amount' => '10.00',
        ]),
        'minimum total' => $code(['min_order_total' => '400.00']),
        'not stackable' => [$code(['stackable_with_offers' => false]), offerFor($this->product, ['type' => 'percentage', 'value' => '10.00'])],
    };

    $q = quote(code: 'TEST', phone: '+201012345678');
    expect($q['code'])->toBeNull()->and($q['code_error'])->toBe($expected);
})->with([
    ['missing', 'كود الخصم غير صحيح.'],
    ['inactive', 'كود الخصم غير صحيح.'],
    ['not started', 'كود الخصم لم يبدأ بعد.'],
    ['expired', 'انتهت صلاحية كود الخصم.'],
    ['other product', 'كود الخصم لا ينطبق على هذا المنتج.'],
    ['used up', 'تم استخدام كود الخصم بالكامل.'],
    ['phone limit', 'تم استخدام هذا الكود بالحد الأقصى لهذا الرقم.'],
    ['minimum total', 'الحد الأدنى للطلب لاستخدام الكود 400 ج.م.'],
    ['not stackable', 'الكود لا يعمل مع العروض الحالية.'],
]);

it('does not count released redemptions toward the per-phone limit', function () {
    $code = DiscountCode::factory()->create(['code' => 'TEST', 'usage_limit_per_phone' => 1]);
    DiscountCodeRedemption::create(['discount_code_id' => $code->id, 'order_id' => 1, 'phone' => '+201012345678', 'amount' => '10.00', 'released_at' => now()]);

    expect(quote(code: 'TEST', phone: '+201012345678')['code_error'])->toBeNull();
});

it('accepts a code restricted to this product and checks the minimum after the offer', function () {
    $code = DiscountCode::factory()->create(['code' => 'ONLY', 'min_order_total' => '600.00']);
    $code->products()->attach($this->product->id, ['tenant_id' => $this->tenant->id]);
    offerFor($this->product, ['type' => 'percentage', 'value' => '20.00']);

    // after offer: 700 × 0.8 = 560 < 600
    expect(quote(qty: 2, code: 'ONLY')['code_error'])->toContain('الحد الأدنى')
        ->and(quote(qty: 3, code: 'ONLY')['code_error'])->toBeNull();
});

it('treats code window bounds as inclusive', function () {
    DiscountCode::factory()->create(['code' => 'WIN', 'starts_at' => $this->now, 'ends_at' => $this->now->addHour()]);

    expect(quote(code: 'WIN', at: $this->now)['code_error'])->toBeNull()
        ->and(quote(code: 'WIN', at: $this->now->addHour())['code_error'])->toBeNull()
        ->and(quote(code: 'WIN', at: $this->now->addHour()->addSecond())['code_error'])->not->toBeNull();
});

it('never sees codes or offers of another tenant', function () {
    $otherTenant = Tenant::factory()->create();
    Tenancy::runAs($otherTenant->id, fn () => DiscountCode::factory()->create(['code' => 'SHARED']));

    expect(quote(code: 'SHARED')['code_error'])->toBe('كود الخصم غير صحيح.');
});
