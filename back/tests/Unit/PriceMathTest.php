<?php

declare(strict_types=1);

use App\Enums\DiscountType;
use App\Enums\OfferType;
use App\Pricing\PriceMath;

/*
| offerTotal(type, value, bundleQty, bundlePrice, baseSubtotal, quantity, productPrice, deltaSum) — all cents.
| Percentage values are percent × 100 (25% = 2500).
*/
dataset('offer cases', [
    'percentage 25% of 700' => [OfferType::Percentage, 2500, null, 0, 70000, 2, 35000, 0, 52500],
    'percentage rounds half up' => [OfferType::Percentage, 1000, null, 0, 33335, 1, 33335, 0, 30001],
    'percentage 95%' => [OfferType::Percentage, 9500, null, 0, 10000, 1, 10000, 0, 500],
    'fixed per unit × qty' => [OfferType::Fixed, 5000, null, 0, 70000, 2, 35000, 0, 60000],
    'fixed never below zero' => [OfferType::Fixed, 50000, null, 0, 35000, 1, 35000, 0, 0],
    'bundle exact groups' => [OfferType::Bundle, 0, 2, 60000, 70000, 2, 35000, 0, 60000],
    'bundle with remainder' => [OfferType::Bundle, 0, 2, 60000, 105000, 3, 35000, 0, 95000],
    'bundle two groups' => [OfferType::Bundle, 0, 2, 60000, 140000, 4, 35000, 0, 120000],
    'bundle with option deltas' => [OfferType::Bundle, 0, 2, 60000, 75000, 2, 35000, 2500, 65000],
    'bundle deltas and remainder' => [OfferType::Bundle, 0, 3, 90000, 150000, 4, 35000, 2500, 135000],
]);

it('computes the total after an offer', function (OfferType $type, int $value, ?int $bq, int $bp, int $base, int $qty, int $price, int $delta, int $expected) {
    expect(PriceMath::offerTotal($type, $value, $bq, $bp, $base, $qty, $price, $delta))->toBe($expected);
})->with('offer cases');

it('does not apply a bundle below its quantity', function () {
    expect(PriceMath::offerTotal(OfferType::Bundle, 0, 3, 90000, 70000, 2, 35000, 0))->toBeNull();
});

it('ignores a bundle that became unprofitable', function () {
    // bundle_price (70000) >= price × qty (35000 × 2)
    expect(PriceMath::offerTotal(OfferType::Bundle, 0, 2, 70000, 70000, 2, 35000, 0))->toBeNull();
});

it('returns null when an offer gives no discount', function () {
    expect(PriceMath::offerTotal(OfferType::Fixed, 0, null, 0, 35000, 1, 35000, 0))->toBeNull();
});

it('picks the lowest total, then highest priority, then oldest id', function () {
    expect(PriceMath::bestOffer([
        ['id' => 1, 'priority' => 0, 'total' => 600],
        ['id' => 2, 'priority' => 0, 'total' => 500],
        ['id' => 3, 'priority' => 0, 'total' => 550],
    ])['id'])->toBe(2)
        ->and(PriceMath::bestOffer([
            ['id' => 5, 'priority' => 1, 'total' => 500],
            ['id' => 4, 'priority' => 9, 'total' => 500],
        ])['id'])->toBe(4)
        ->and(PriceMath::bestOffer([
            ['id' => 8, 'priority' => 3, 'total' => 500],
            ['id' => 7, 'priority' => 3, 'total' => 500],
        ])['id'])->toBe(7)
        ->and(PriceMath::bestOffer([]))->toBeNull();
});

dataset('code cases', [
    'percentage' => [DiscountType::Percentage, 2500, null, 60000, 15000],
    'percentage capped by max' => [DiscountType::Percentage, 2500, 10000, 60000, 10000],
    'percentage under the cap' => [DiscountType::Percentage, 2500, 20000, 60000, 15000],
    'percentage rounds half up' => [DiscountType::Percentage, 1500, null, 3333, 500],
    'fixed' => [DiscountType::Fixed, 5000, null, 60000, 5000],
    'fixed larger than the amount' => [DiscountType::Fixed, 90000, null, 60000, 60000],
    'max is ignored for fixed' => [DiscountType::Fixed, 5000, 1000, 60000, 5000],
    '100% never exceeds the amount' => [DiscountType::Percentage, 10000, null, 60000, 60000],
]);

it('computes the code discount', function (DiscountType $type, int $value, ?int $max, int $after, int $expected) {
    expect(PriceMath::codeDiscount($type, $value, $max, $after))->toBe($expected);
})->with('code cases');
