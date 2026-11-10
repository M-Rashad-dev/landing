<?php

declare(strict_types=1);

use App\Billing\Entitlements;
use App\Billing\PlanCatalog;
use App\Billing\TenantEntitlements;
use App\Enums\AccessState;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Exceptions\ApiException;
use App\Models\EntitlementOverride;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\Tenant;

function entitlementsOf(Tenant $tenant): TenantEntitlements
{
    Entitlements::forget($tenant->id);

    return app(Entitlements::class)->for($tenant->fresh());
}

it('reads the plan values of the running plan', function (string $plan, int $products, bool $upsells) {
    $e = entitlementsOf(Tenant::factory()->onPlan($plan)->create());

    expect($e->state)->toBe(AccessState::Active)
        ->and($e->planKey)->toBe($plan)
        ->and($e->limit(PlanLimit::Products))->toBe($products)
        ->and($e->allows(PlanFeature::Upsells))->toBe($upsells);
})->with([
    'basic' => ['basic', 5, false],
    'pro' => ['pro', 20, true],
    'max' => ['max', 200, true],
]);

it('treats a null plan value as unlimited up to the safety cap', function () {
    config(['landing.limits.pages' => 77]);
    $e = entitlementsOf(Tenant::factory()->onPlan('max')->create());

    expect($e->isUnlimited(PlanLimit::LandingPages))->toBeTrue()
        ->and($e->limit(PlanLimit::LandingPages))->toBe(77);
});

it('keeps the safety cap above a plan value', function () {
    config(['landing.limits.products' => 3]);

    expect(entitlementsOf(Tenant::factory()->onPlan('max')->create())->limit(PlanLimit::Products))->toBe(3);
});

it('closes a missing value instead of opening it', function () {
    PlanFeatureValue::query()->where('plan_key', 'pro')->where('entitlement', 'upsells')->delete();
    PlanCatalog::flush();

    expect(entitlementsOf(Tenant::factory()->onPlan('pro')->create())->allows(PlanFeature::Upsells))->toBeFalse();
});

it('picks up admin plan edits at once (catalog cache flushed)', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();
    expect(entitlementsOf($tenant)->limit(PlanLimit::Products))->toBe(5);

    PlanFeatureValue::query()->where('plan_key', 'basic')->where('entitlement', 'products')->firstOrFail()->update(['value' => 8]);

    expect(entitlementsOf($tenant)->limit(PlanLimit::Products))->toBe(8);
});

it('lets an override win over the plan until it expires', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();
    asTenant($tenant, fn () => EntitlementOverride::query()->create(['entitlement' => 'products', 'value' => 50, 'reason' => 'test']));
    asTenant($tenant, fn () => EntitlementOverride::query()->create(['entitlement' => 'upsells', 'value' => 1, 'reason' => 'test', 'expires_at' => now()->subMinute()]));

    $e = entitlementsOf($tenant);
    expect($e->limit(PlanLimit::Products))->toBe(50)
        ->and($e->allows(PlanFeature::Upsells))->toBeFalse();
});

it('is in grace after the period and closed after the grace hours', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $tenant->forceFill(['plan_ends_at' => now()->subHour(), 'plan_grace_ends_at' => now()->addHours(23)])->save();

    $e = entitlementsOf($tenant);
    expect($e->state)->toBe(AccessState::Grace)
        ->and($e->allows(PlanFeature::Upsells))->toBeTrue();

    $tenant->forceFill(['plan_grace_ends_at' => now()->subMinute()])->save();
    $e = entitlementsOf($tenant);
    expect($e->state)->toBe(AccessState::Expired)
        ->and($e->allows(PlanFeature::Upsells))->toBeFalse()
        ->and($e->limit(PlanLimit::Products))->toBe(0);
});

it('is expired without any plan', function () {
    expect(entitlementsOf(Tenant::factory()->withoutPlan()->create())->state)->toBe(AccessState::Expired);
});

it('refuses to add past the limit with the upgrade plan in the error', function () {
    $owner = createOwner();
    $owner->tenant->forceFill(['plan_key' => 'basic'])->save();

    try {
        asTenant($owner, function () {
            Product::factory()->count(5)->create();
            app(Entitlements::class)->ensureCanAdd(PlanLimit::Products);
        });
        $this->fail('expected a limit error');
    } catch (ApiException $e) {
        expect($e->status)->toBe(403)
            ->and($e->errorCode)->toBe('plan_limit_reached')
            ->and($e->extra['limit'])->toBe(5)
            ->and($e->extra['used'])->toBe(5)
            ->and($e->extra['upgrade_to'])->toBe(['key' => 'pro', 'name' => 'برو']);
    }
});

it('refuses a locked feature naming the cheapest plan that has it', function () {
    $owner = createOwner();
    $owner->tenant->forceFill(['plan_key' => 'pro'])->save();

    try {
        asTenant($owner, fn () => app(Entitlements::class)->ensure(PlanFeature::RemoveBranding));
        $this->fail('expected a feature error');
    } catch (ApiException $e) {
        expect($e->errorCode)->toBe('plan_feature_locked')
            ->and($e->extra['upgrade_to'])->toBe(['key' => 'max', 'name' => 'ماكس']);
    }
});
