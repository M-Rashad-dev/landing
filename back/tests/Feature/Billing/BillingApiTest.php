<?php

declare(strict_types=1);

use App\Billing\BillingPriceCalculator;
use App\Billing\PlanCatalog;
use App\Billing\PlanLocks;
use App\Billing\PlanPresenter;
use App\Billing\SubscriptionManager;
use App\Enums\BillingPeriod;
use App\Models\AdminAuditLog;
use App\Models\EntitlementOverride;
use App\Models\LandingPage;
use App\Models\Plan;
use App\Models\PlanFeatureValue;
use App\Models\PlanPrice;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

function billingOwner(string $plan = 'pro'): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create();
    $user = User::factory()->for($tenant)->create();
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function planPayload(array $overrides = []): array
{
    $values = [];
    foreach (PlanPresenter::entitlementCatalog() as $e) {
        $values[$e['key']] = $e['kind'] === 'feature' ? false : 1;
    }

    return array_replace_recursive([
        'name' => 'باقة',
        'tagline' => null,
        'description' => null,
        'marketing_points' => ['دعم'],
        'is_public' => true,
        'is_highlighted' => false,
        'is_archived' => false,
        'sort_order' => 5,
        'prices' => [
            'monthly' => ['price' => 70, 'discount_percent' => 0, 'discount_starts_at' => null, 'discount_ends_at' => null, 'is_active' => true],
            'yearly' => null,
        ],
        'values' => $values,
    ], $overrides);
}

// --- dashboard ---------------------------------------------------------------------------

it('needs a signed-in owner', function () {
    $this->getJson('/api/v1/dashboard/billing/entitlements')->assertUnauthorized();
    $this->getJson('/api/v1/dashboard/billing/plans')->assertUnauthorized();
    $this->putJson('/api/v1/dashboard/billing/locks/landing_pages', ['active_ids' => []])->assertUnauthorized();
});

it('returns the entitlements of the store', function () {
    billingOwner('pro');

    $this->getJson('/api/v1/dashboard/billing/entitlements')
        ->assertOk()
        ->assertJsonPath('data.state', 'active')
        ->assertJsonPath('data.plan.key', 'pro')
        ->assertJsonPath('data.features.upsells', true)
        ->assertJsonPath('data.features.remove_branding', false)
        ->assertJsonPath('data.limits.products.limit', 20)
        ->assertJsonPath('data.limits.products.unlimited', false)
        ->assertJsonPath('data.renewal_due', false);
});

it('flags the renewal banner in the last 7 days and answers on an expired plan', function () {
    $owner = billingOwner('pro');
    $owner->tenant->forceFill(['plan_ends_at' => now()->addDays(3)])->save();
    Sanctum::actingAs($owner->fresh(['tenant']));
    $this->getJson('/api/v1/dashboard/billing/entitlements')->assertJsonPath('data.renewal_due', true)->assertJsonPath('data.days_left', 3);

    $owner->tenant->forceFill(['plan_ends_at' => now()->subDays(5), 'plan_grace_ends_at' => now()->subDays(4)])->save();
    Sanctum::actingAs($owner->fresh(['tenant']));
    $this->getJson('/api/v1/dashboard/billing/entitlements')->assertOk()->assertJsonPath('data.state', 'expired')->assertJsonPath('data.limits.products.limit', 0);
});

it('counts usage only for its own store', function () {
    $owner = billingOwner('basic');
    asTenant($owner, fn () => Product::factory()->count(2)->create());
    asTenant(Tenant::factory()->create(), fn () => Product::factory()->count(7)->create());

    $usage = collect($this->getJson('/api/v1/dashboard/billing/usage')->assertOk()->json('data'))->keyBy('key');

    expect($usage['products']['used'])->toBe(2)->and($usage['products']['limit'])->toBe(5);
});

it('prices the plans with the upgrade difference inside the first 7 days', function () {
    $owner = billingOwner('pro');
    $tenant = $owner->tenant;
    // A paid pro month started 2 days ago.
    asTenant($tenant, fn () => Subscription::query()->delete());
    $this->travelTo(now()->subDays(2));
    app(SubscriptionManager::class)->subscribe($tenant, app(BillingPriceCalculator::class)->planPrice('pro', BillingPeriod::Monthly), 10000, startsNow: true);
    $this->travelBack();
    Sanctum::actingAs($owner->fresh(['tenant']));

    $plans = collect($this->getJson('/api/v1/dashboard/billing/plans')->assertOk()->assertJsonCount(3, 'data')->json('data'))->keyBy('key');

    expect($plans['max']['prices']['monthly']['change']['pay'])->toEqual(50)
        ->and($plans['max']['prices']['monthly']['change']['starts_now'])->toBeTrue()
        ->and($plans['pro']['prices']['monthly']['is_current'])->toBeTrue()
        ->and($plans['basic']['prices']['monthly']['change']['starts_now'])->toBeFalse()
        ->and($plans['basic']['values']['products'])->toBe(5);
});

it('marks a granted plan (no period) as current in both periods', function () {
    billingOwner('pro');

    $plans = collect($this->getJson('/api/v1/dashboard/billing/plans')->assertOk()->json('data'))->keyBy('key');

    expect($plans['pro']['prices']['monthly']['is_current'])->toBeTrue()
        ->and($plans['pro']['prices']['yearly']['is_current'])->toBeTrue()
        ->and($plans['max']['prices']['monthly']['is_current'])->toBeFalse();
});

it('lists only its own subscriptions', function () {
    billingOwner('pro');
    Tenant::factory()->onPlan('max')->create();

    $this->getJson('/api/v1/dashboard/billing/subscriptions')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.plan.key', 'pro');
});

it('lists lock rows and lets the owner choose what stays live', function () {
    $owner = billingOwner('basic');
    $pages = asTenant($owner, fn () => LandingPage::factory()->count(4)->create());
    app(PlanLocks::class)->sync($owner->tenant->fresh());

    $this->getJson('/api/v1/dashboard/billing/locks/landing_pages')->assertOk()->assertJsonCount(4, 'data')->assertJsonPath('meta.limit', 3);
    $this->putJson('/api/v1/dashboard/billing/locks/landing_pages', ['active_ids' => [$pages[0]->id]])->assertOk();

    expect(asTenant($owner, fn () => LandingPage::query()->where('locked_by_plan', false)->pluck('id')->all()))->toBe([$pages[0]->id]);
});

it('validates lock choices and hides other stores rows', function () {
    $owner = billingOwner('basic');
    $foreign = asTenant(Tenant::factory()->create(), fn () => LandingPage::factory()->create());

    $this->putJson('/api/v1/dashboard/billing/locks/landing_pages', ['active_ids' => 'x'])->assertStatus(422)->assertJsonValidationErrors('active_ids');
    $this->putJson('/api/v1/dashboard/billing/locks/landing_pages', ['active_ids' => [$foreign->id]])->assertNotFound();
    $this->getJson('/api/v1/dashboard/billing/locks/media_storage_mb')->assertNotFound();
    $this->getJson('/api/v1/dashboard/billing/locks/unknown')->assertNotFound();
});

// --- public pricing --------------------------------------------------------------------

it('serves public plans without archived or hidden ones', function () {
    Plan::query()->whereKey('max')->update(['is_public' => false]);
    PlanCatalog::flush();

    $this->getJson('/api/v1/plans')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.key', 'basic')->assertJsonPath('data.0.prices.monthly.final', 50);
});

// --- admin -----------------------------------------------------------------------------

it('keeps the plan admin to super admins', function () {
    $this->getJson('/api/v1/admin/plans')->assertUnauthorized();
    billingOwner();
    $this->getJson('/api/v1/admin/plans')->assertForbidden();
    $this->postJson('/api/v1/admin/tenants/1/billing/extend', ['days' => 3])->assertForbidden();
});

it('lists plans with subscribers, catalog and settings', function () {
    Tenant::factory()->onPlan('pro')->count(2)->create();
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $plans = collect($this->getJson('/api/v1/admin/plans')->assertOk()->assertJsonPath('meta.settings.trial_plan_key', 'basic')->json('data'))->keyBy('key');

    expect($plans['pro']['subscribers'])->toBe(2)->and($plans['max']['values']['landing_pages'])->toBeNull();
});

it('updates a plan, audits it and re-locks stores over a lowered limit', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();
    asTenant($tenant, fn () => LandingPage::factory()->count(3)->create());
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $payload = planPayload(['name' => 'بيسك جديدة', 'values' => ['landing_pages' => 1, 'upsells' => true], 'prices' => ['monthly' => ['price' => 55, 'discount_percent' => 20]]]);
    $this->putJson('/api/v1/admin/plans/basic', $payload)->assertOk()->assertJsonPath('data.name', 'بيسك جديدة')->assertJsonPath('data.prices.monthly.now.final', 44);

    expect(PlanFeatureValue::query()->where('plan_key', 'basic')->where('entitlement', 'upsells')->value('value'))->toBe(1)
        ->and(PlanPrice::query()->where('plan_key', 'basic')->where('period', 'yearly')->exists())->toBeFalse()
        ->and(asTenant($tenant, fn () => LandingPage::query()->where('locked_by_plan', true)->count()))->toBe(2)
        ->and(AdminAuditLog::query()->where('action', 'plan.update')->where('target_id', 'basic')->exists())->toBeTrue();
});

it('validates plans', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->putJson('/api/v1/admin/plans/pro', planPayload(['values' => ['products' => -1, 'upsells' => 'maybe'], 'prices' => ['monthly' => ['price' => 'x', 'discount_percent' => 95]]]))
        ->assertStatus(422)
        ->assertJsonValidationErrors(['values.products', 'values.upsells', 'prices.monthly.price', 'prices.monthly.discount_percent']);
    $this->putJson('/api/v1/admin/plans/pro', planPayload(['prices' => ['monthly' => null]]))->assertStatus(422)->assertJsonValidationErrors('prices');
    $this->postJson('/api/v1/admin/plans', planPayload(['key' => 'pro']))->assertStatus(422)->assertJsonValidationErrors('key');
    $this->postJson('/api/v1/admin/plans', planPayload(['key' => 'Bad Key']))->assertStatus(422)->assertJsonValidationErrors('key');
    $this->putJson('/api/v1/admin/plans/basic', planPayload(['is_archived' => true]))->assertStatus(422)->assertJsonPath('code', 'trial_plan_invalid');
    $this->putJson('/api/v1/admin/plans/nope', planPayload())->assertNotFound();
});

it('creates a plan and deletes it only while nobody used it', function () {
    Tenant::factory()->onPlan('pro')->create();
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->postJson('/api/v1/admin/plans', planPayload(['key' => 'vip', 'is_public' => false]))->assertCreated()->assertJsonPath('data.key', 'vip');
    $this->deleteJson('/api/v1/admin/plans/pro')->assertStatus(422)->assertJsonPath('code', 'plan_has_subscribers');
    $this->deleteJson('/api/v1/admin/plans/vip')->assertNoContent();
    $this->deleteJson('/api/v1/admin/plans/basic')->assertStatus(422);
});

it('saves the trial settings', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->putJson('/api/v1/admin/billing/settings', ['trial_enabled' => false, 'trial_days' => 7, 'trial_plan_key' => 'pro', 'grace_hours' => 48])
        ->assertOk()->assertJsonPath('data.trial_days', 7)->assertJsonPath('data.trial_enabled', false);
    $this->putJson('/api/v1/admin/billing/settings', ['trial_enabled' => true, 'trial_days' => 0, 'trial_plan_key' => 'nope', 'grace_hours' => 500])
        ->assertStatus(422)->assertJsonValidationErrors(['trial_days', 'trial_plan_key', 'grace_hours']);
});

it('grants, extends and overrides one store from the admin', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/billing/grant", ['plan_key' => 'max', 'days' => 10, 'note' => 'شريك'])
        ->assertOk()->assertJsonPath('data.plan.key', 'max')->assertJsonCount(2, 'data.subscriptions');
    $ends = $tenant->fresh()->plan_ends_at;
    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/billing/extend", ['days' => 5])->assertOk();
    expect($tenant->fresh()->plan_ends_at->equalTo($ends->copy()->addDays(5)))->toBeTrue();

    $this->putJson("/api/v1/admin/tenants/{$tenant->id}/billing/overrides/products", ['value' => 999, 'reason' => 'عميل كبير'])
        ->assertOk()->assertJsonPath('data.overrides.0.value', 999);
    $this->putJson("/api/v1/admin/tenants/{$tenant->id}/billing/overrides/upsells", ['value' => 'x', 'reason' => 'x'])->assertStatus(422);
    $this->putJson("/api/v1/admin/tenants/{$tenant->id}/billing/overrides/unknown", ['value' => 1, 'reason' => 'abc'])->assertNotFound();
    $this->deleteJson("/api/v1/admin/tenants/{$tenant->id}/billing/overrides/products")->assertNoContent();

    expect(asTenant($tenant, fn () => EntitlementOverride::query()->count()))->toBe(0)
        ->and(AdminAuditLog::query()->whereIn('action', ['subscription.grant', 'subscription.extend', 'override.set', 'override.delete'])->count())->toBe(4);
});

it('refuses to extend a store without a running plan', function () {
    $tenant = Tenant::factory()->withoutPlan()->create();
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/billing/extend", ['days' => 5])->assertStatus(422)->assertJsonPath('code', 'no_running_subscription');
    $this->postJson("/api/v1/admin/tenants/{$tenant->id}/billing/grant", ['plan_key' => 'nope', 'days' => 0])->assertStatus(422)->assertJsonValidationErrors(['plan_key', 'days']);
    $this->getJson('/api/v1/admin/tenants/999999/billing')->assertNotFound();
});

it('shows plan counts on the admin overview', function () {
    Tenant::factory()->onPlan('pro')->create();
    Tenant::factory()->expired('pro')->create();
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $this->getJson('/api/v1/admin/overview')->assertOk()->assertJsonPath('data.plans.0.name', 'برو')->assertJsonPath('data.plans.0.total', 1)->assertJsonPath('data.expired', 1);
});

it('sends the plan with the session so the layout needs no extra call', function () {
    billingOwner('basic');

    $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.plan.plan.key', 'basic')->assertJsonPath('data.plan.features.upsells', false);
    $this->getJson('/api/v1/dashboard/billing/usage?keys=products,offers')->assertOk()->assertJsonCount(2, 'data');
});
