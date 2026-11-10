<?php

declare(strict_types=1);

use App\Billing\BillingPriceCalculator;
use App\Enums\BillingPeriod;
use App\Enums\SubscriptionSource;
use App\Models\PlanPrice;
use App\Models\Subscription;
use Carbon\CarbonImmutable;

dataset('discounts', [
    'no discount keeps piasters' => [9950, 0, 9950],
    '20% of 100' => [10000, 20, 8000],
    '15% of 1200 → 1020' => [120000, 15, 102000],
    'rounds to the nearest pound up' => [9900, 15, 8400],   // 84.15 → 84
    'rounds half up' => [15000, 33, 10100],                 // 100.50 → 101
    'capped at 90%' => [10000, 95, 1000],
]);

it('applies a percentage and rounds to the pound', function (int $cents, int $percent, int $expected) {
    expect(BillingPriceCalculator::discounted($cents, $percent))->toBe($expected);
})->with('discounts');

function calc(): BillingPriceCalculator
{
    return app(BillingPriceCalculator::class);
}

it('prices a plan period from the catalog', function () {
    $quote = calc()->planPrice('pro', BillingPeriod::Yearly);

    expect($quote->originalCents)->toBe(120000)->and($quote->finalCents)->toBe(120000)->and($quote->hasDiscount())->toBeFalse();
});

it('applies a discount only inside its dates (both ends inclusive)', function () {
    $start = CarbonImmutable::parse('2026-12-01 00:00:00');
    $end = CarbonImmutable::parse('2026-12-31 23:59:59');
    PlanPrice::query()->where('plan_key', 'pro')->where('period', 'monthly')->firstOrFail()
        ->update(['discount_percent' => 20, 'discount_starts_at' => $start, 'discount_ends_at' => $end]);

    expect(calc()->planPrice('pro', BillingPeriod::Monthly, $start->subSecond())->finalCents)->toBe(10000)
        ->and(calc()->planPrice('pro', BillingPeriod::Monthly, $start)->finalCents)->toBe(8000)
        ->and(calc()->planPrice('pro', BillingPeriod::Monthly, $end)->finalCents)->toBe(8000)
        ->and(calc()->planPrice('pro', BillingPeriod::Monthly, $end)->discountEndsAt?->equalTo($end))->toBeTrue()
        ->and(calc()->planPrice('pro', BillingPeriod::Monthly, $end->addSecond())->finalCents)->toBe(10000);
});

it('has no price for an inactive period', function () {
    PlanPrice::query()->where('plan_key', 'max')->where('period', 'yearly')->firstOrFail()->update(['is_active' => false]);

    expect(calc()->planPrice('max', BillingPeriod::Yearly))->toBeNull()
        ->and(calc()->planPrice('nope', BillingPeriod::Monthly))->toBeNull();
});

function paidSub(string $plan, BillingPeriod $period, int $paidCents, CarbonImmutable $starts): Subscription
{
    return new Subscription([
        'plan_key' => $plan, 'period' => $period, 'source' => SubscriptionSource::Payment,
        'starts_at' => $starts, 'ends_at' => $starts->addDays($period->days()), 'amount_paid' => $paidCents / 100,
    ]);
}

it('charges only the difference when upgrading within 7 days (owner example: pro 100 → max 150 after 5 days = 50)', function () {
    $start = CarbonImmutable::parse('2026-11-01 10:00');
    $current = paidSub('pro', BillingPeriod::Monthly, 10000, $start);
    $quote = calc()->change($current, calc()->planPrice('max', BillingPeriod::Monthly), $start->addDays(5));

    expect($quote->startsNow)->toBeTrue()->and($quote->creditCents)->toBe(10000)->and($quote->payCents)->toBe(5000);
});

it('charges the full price after the 7 days', function () {
    $start = CarbonImmutable::parse('2026-11-01 10:00');
    $quote = calc()->change(paidSub('pro', BillingPeriod::Monthly, 10000, $start), calc()->planPrice('max', BillingPeriod::Monthly), $start->addDays(7));

    expect($quote->payCents)->toBe(15000)->and($quote->creditCents)->toBe(0)->and($quote->startsNow)->toBeTrue();
});

it('treats monthly → yearly on the same plan as an upgrade', function () {
    $start = CarbonImmutable::parse('2026-11-01');
    $quote = calc()->change(paidSub('pro', BillingPeriod::Monthly, 10000, $start), calc()->planPrice('pro', BillingPeriod::Yearly), $start->addDay());

    expect($quote->startsNow)->toBeTrue()->and($quote->payCents)->toBe(110000);
});

it('never pays below zero when the credit is bigger', function () {
    $start = CarbonImmutable::parse('2026-11-01');
    $quote = calc()->change(paidSub('pro', BillingPeriod::Yearly, 120000, $start), calc()->planPrice('max', BillingPeriod::Monthly), $start->addDay());

    expect($quote->payCents)->toBe(0);
});

it('queues renewals and downgrades after the current period at full price', function () {
    $start = CarbonImmutable::parse('2026-11-01');
    $renew = calc()->change(paidSub('pro', BillingPeriod::Monthly, 10000, $start), calc()->planPrice('pro', BillingPeriod::Monthly), $start->addDay());
    $down = calc()->change(paidSub('max', BillingPeriod::Monthly, 15000, $start), calc()->planPrice('pro', BillingPeriod::Monthly), $start->addDay());

    expect($renew->startsNow)->toBeFalse()->and($renew->payCents)->toBe(10000)
        ->and($down->startsNow)->toBeFalse()->and($down->payCents)->toBe(10000);
});

it('gives no credit for a trial and starts the paid plan now', function () {
    $start = CarbonImmutable::parse('2026-11-01');
    $trial = new Subscription(['plan_key' => 'basic', 'period' => null, 'source' => SubscriptionSource::Trial, 'starts_at' => $start, 'ends_at' => $start->addDays(14), 'amount_paid' => 0]);
    $quote = calc()->change($trial, calc()->planPrice('basic', BillingPeriod::Monthly), $start->addDay());

    expect($quote->startsNow)->toBeTrue()->and($quote->payCents)->toBe(5000);
});
