<?php

declare(strict_types=1);

use App\Billing\BillingPriceCalculator;
use App\Billing\PlatformSettings;
use App\Billing\SubscriptionManager;
use App\Enums\AccessState;
use App\Enums\BillingPeriod;
use App\Enums\SubscriptionSource;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Tenant;
use Illuminate\Support\Carbon;

function manager(): SubscriptionManager
{
    return app(SubscriptionManager::class);
}

function subsOf(Tenant $tenant)
{
    return asTenant($tenant, fn () => Subscription::query()->orderBy('id')->get());
}

it('starts the trial once, on the admin trial plan', function () {
    app(PlatformSettings::class)->save(['trial_days' => 10, 'trial_plan_key' => 'pro']);
    $tenant = Tenant::factory()->withoutPlan()->create();

    $sub = manager()->startTrial($tenant);

    expect($sub->source)->toBe(SubscriptionSource::Trial)
        ->and($sub->plan_key)->toBe('pro')
        ->and($tenant->fresh()->plan_key)->toBe('pro')
        ->and($tenant->fresh()->accessState())->toBe(AccessState::Active)
        ->and((int) round($sub->starts_at->diffInDays($sub->ends_at)))->toBe(10)
        ->and(manager()->startTrial($tenant->fresh()))->toBeNull();
});

it('gives no trial when the admin turned it off', function () {
    app(PlatformSettings::class)->save(['trial_enabled' => false]);
    $tenant = Tenant::factory()->withoutPlan()->create();

    expect(manager()->startTrial($tenant))->toBeNull()
        ->and($tenant->fresh()->accessState())->toBe(AccessState::Expired);
});

it('grants a plan that replaces the running one', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();

    manager()->grant($tenant, 'max', 60, 'vip', null);

    $subs = subsOf($tenant);
    expect($subs)->toHaveCount(2)
        ->and($subs[0]->status)->toBe(SubscriptionStatus::Replaced)
        ->and($subs[1]->plan_key)->toBe('max')
        ->and($tenant->fresh()->plan_key)->toBe('max');
});

it('extends the running period and pushes queued ones', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $oldEnd = $tenant->fresh()->plan_ends_at;
    manager()->subscribe($tenant, app(BillingPriceCalculator::class)->planPrice('pro', BillingPeriod::Monthly), 10000, startsNow: false);

    manager()->extend($tenant, 5);

    $subs = subsOf($tenant);
    expect($subs[0]->ends_at->equalTo($oldEnd->copy()->addDays(5)))->toBeTrue()
        ->and($subs[1]->starts_at->equalTo($oldEnd->copy()->addDays(5)))->toBeTrue()
        ->and($tenant->fresh()->plan_ends_at->equalTo($oldEnd->copy()->addDays(5)))->toBeTrue();
});

it('goes active → grace → expired by dates and the sync follows', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $end = $tenant->fresh()->plan_ends_at;

    $this->travelTo($end->copy()->addHours(2));
    manager()->sync($tenant);
    expect($tenant->fresh()->accessState())->toBe(AccessState::Grace)
        ->and($tenant->fresh()->plan_next_check_at->toIso8601String())->toBe($end->copy()->addHours(24)->toIso8601String());

    $this->travelTo($end->copy()->addHours(25));
    expect(manager()->sync($tenant))->toBeTrue();
    expect($tenant->fresh()->accessState())->toBe(AccessState::Expired)
        ->and($tenant->fresh()->plan_next_check_at)->toBeNull();
});

it('switches to a queued period when the current one ends', function () {
    $tenant = Tenant::factory()->onPlan('max')->create();
    $end = $tenant->fresh()->plan_ends_at;
    manager()->subscribe($tenant, app(BillingPriceCalculator::class)->planPrice('pro', BillingPeriod::Monthly), 10000, startsNow: false);
    expect($tenant->fresh()->plan_key)->toBe('max')
        ->and($tenant->fresh()->plan_next_check_at->equalTo($end))->toBeTrue();

    $this->travelTo($end->copy()->addMinute());
    manager()->sync($tenant);

    expect($tenant->fresh()->plan_key)->toBe('pro')->and($tenant->fresh()->plan_period)->toBe(BillingPeriod::Monthly);
});

it('starts an upgrade now and keeps a fresh full period', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $this->freezeSecond();

    $sub = manager()->subscribe($tenant, app(BillingPriceCalculator::class)->planPrice('max', BillingPeriod::Monthly), 5000, startsNow: true);

    expect($sub->starts_at->equalTo(now()))->toBeTrue()
        ->and($sub->ends_at->equalTo(now()->addDays(30)))->toBeTrue()
        ->and($sub->amount_paid)->toBe('50.00')
        ->and($tenant->fresh()->plan_key)->toBe('max')
        ->and(subsOf($tenant)[0]->status)->toBe(SubscriptionStatus::Replaced);
});

it('allows a refund within 3 days, once per 180 days, with no grace', function () {
    $tenant = Tenant::factory()->withoutPlan()->create();
    $price = app(BillingPriceCalculator::class)->planPrice('pro', BillingPeriod::Monthly);
    $sub = manager()->subscribe($tenant, $price, 10000, startsNow: true);

    $this->travel(2)->days();
    expect(manager()->refundable($tenant)?->id)->toBe($sub->id);

    manager()->markRefunded($tenant, $sub);
    expect($tenant->fresh()->accessState())->toBe(AccessState::Expired);

    // Pays again a month later: inside the 180 days, so no second refund.
    $this->travel(30)->days();
    manager()->subscribe($tenant, $price, 10000, startsNow: true);
    expect(manager()->refundable($tenant))->toBeNull();

    $this->travel(181)->days();
    $again = manager()->subscribe($tenant, $price, 10000, startsNow: true);
    expect(manager()->refundable($tenant)?->id)->toBe($again->id);
});

it('allows no refund after 3 days or for a trial', function () {
    $tenant = Tenant::factory()->withoutPlan()->create();
    manager()->startTrial($tenant);
    expect(manager()->refundable($tenant))->toBeNull();

    manager()->subscribe($tenant, app(BillingPriceCalculator::class)->planPrice('pro', BillingPeriod::Monthly), 10000, startsNow: true);
    Carbon::setTestNow(now()->addDays(3));
    expect(manager()->refundable($tenant))->toBeNull();
});

it('sweeps only tenants whose plan state is due', function () {
    $due = Tenant::factory()->onPlan('pro')->create();
    $later = Tenant::factory()->onPlan('pro')->create();
    $later->forceFill(['plan_next_check_at' => now()->addDays(60)])->save();

    $this->travelTo($due->fresh()->plan_ends_at->copy()->addHours(30));
    $this->artisan('subscriptions:sweep')->assertSuccessful();

    expect($due->fresh()->plan_state)->toBe('closed')
        ->and($due->fresh()->plan_next_check_at)->toBeNull()
        ->and($later->fresh()->plan_state)->toBe('open');
});
