<?php

declare(strict_types=1);

use App\Billing\PlanLocks;
use App\Billing\SubscriptionManager;
use App\Enums\AbTestStatus;
use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\PlanLimit;
use App\Exceptions\ApiException;
use App\Models\AbTest;
use App\Models\DiscountCode;
use App\Models\Domain;
use App\Models\EntitlementOverride;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\Upsell;
use App\Models\User;
use App\Models\Webhook;
use Database\Factories\LandingPageFactory;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;

/** An owner on a given plan, signed in. */
function planOwner(string $plan = 'basic', bool $expired = false): User
{
    $tenant = $expired ? Tenant::factory()->expired($plan)->create() : Tenant::factory()->onPlan($plan)->create();
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create();
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function planSitePage(Tenant $tenant, string $host, array $attributes = []): LandingPage
{
    return asTenant($tenant, function () use ($attributes) {
        $identity = Identity::factory()->default()->create();
        $product = $attributes['product'] ?? Product::factory()->create();
        unset($attributes['product']);

        return LandingPage::factory()
            ->withSections([
                LandingPageFactory::section('hero', ['title' => 'x'], true, 'split'),
                LandingPageFactory::section('order_form', [], true, 'card'),
            ])
            ->published()
            ->create(array_merge(['slug' => 'offer', 'identity_id' => $identity->id, 'product_id' => $product->id], $attributes));
    });
}

function planPublic(string $path, array $query)
{
    return test()->getJson('/api/v1/public/'.$path.'?'.http_build_query($query), internalHeaders());
}

// --- limits through the API -------------------------------------------------------------

it('stops a basic store at 5 products and names the upgrade', function () {
    $owner = planOwner('basic');
    asTenant($owner, fn () => Product::factory()->count(5)->create());

    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10])
        ->assertForbidden()
        ->assertJsonPath('code', 'plan_limit_reached')
        ->assertJsonPath('limit_key', 'products')
        ->assertJsonPath('limit', 5)
        ->assertJsonPath('used', 5)
        ->assertJsonPath('upgrade_to.key', 'pro');
});

it('lets a pro store go past the basic limit', function () {
    $owner = planOwner('pro');
    asTenant($owner, fn () => Product::factory()->count(5)->create());

    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10])->assertCreated();
});

it('counts the basic page limit (3) on create and duplicate', function () {
    $owner = planOwner('basic');
    $pages = asTenant($owner, fn () => LandingPage::factory()->count(3)->create());
    $product = asTenant($owner, fn () => Product::factory()->create());

    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'new-page', 'theme_key' => 'bidaya', 'product_id' => $product->id])->assertForbidden()->assertJsonPath('code', 'plan_limit_reached');
    $this->postJson("/api/v1/dashboard/pages/{$pages[0]->id}/duplicate")->assertForbidden()->assertJsonPath('limit_key', 'landing_pages');
});

it('refuses custom domains on basic (limit 0)', function () {
    planOwner('basic');

    $this->postJson('/api/v1/dashboard/domains/custom', ['host' => 'shop.com'])->assertForbidden()->assertJsonPath('limit_key', 'custom_domains');
    $this->getJson('/api/v1/dashboard/domains')->assertOk()->assertJsonPath('meta.custom_limit', 0);
});

it('stops basic at 2 offers, 2 codes, 0 integrations and 0 A/B tests', function () {
    $owner = planOwner('basic');
    $product = asTenant($owner, function () {
        Offer::factory()->count(2)->create();
        DiscountCode::factory()->count(2)->create();

        return Product::factory()->create();
    });

    $this->postJson('/api/v1/dashboard/offers', ['name' => 'x', 'type' => 'percentage', 'value' => 10, 'is_active' => true, 'priority' => 0, 'product_ids' => [$product->id]])->assertForbidden()->assertJsonPath('limit_key', 'offers');
    $this->postJson('/api/v1/dashboard/discount-codes', ['code' => 'NEW', 'type' => 'percentage', 'value' => 10, 'is_active' => true])->assertForbidden()->assertJsonPath('limit_key', 'discount_codes');
    $this->postJson('/api/v1/dashboard/integrations', ['kind' => 'webhook'])->assertForbidden()->assertJsonPath('limit_key', 'webhooks');
    $this->postJson('/api/v1/dashboard/ab-tests', ['name' => 'x'])->assertForbidden()->assertJsonPath('limit_key', 'ab_tests');
});

it('refuses an upload that passes the storage limit', function () {
    $owner = planOwner('basic');
    asTenant($owner, fn () => Media::factory()->create(['size_bytes' => 200 * 1048576]));

    $this->post('/api/v1/dashboard/media', ['files' => [UploadedFile::fake()->image('a.jpg', 60, 60)]])
        ->assertForbidden()
        ->assertJsonPath('limit_key', 'media_storage_mb');
    expect(asTenant($owner, fn () => Media::query()->count()))->toBe(1);
});

it('lets an admin override lift one limit for one store', function () {
    $owner = planOwner('basic');
    asTenant($owner, function () {
        Product::factory()->count(5)->create();
        EntitlementOverride::query()->create(['entitlement' => 'products', 'value' => 6, 'reason' => 'gift']);
    });

    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10])->assertCreated();
    $this->postJson('/api/v1/dashboard/products', ['name' => 'y', 'price' => 10])->assertForbidden();
});

// --- features -----------------------------------------------------------------------------

it('locks upsells on basic but always allows turning one off', function () {
    $owner = planOwner('basic');
    $upsell = asTenant($owner, function () {
        $product = Product::factory()->create();

        return Upsell::query()->create(['name' => 'x', 'offer_product_id' => $product->id, 'price' => 10, 'headline' => 'x', 'is_active' => true]);
    });

    $this->postJson('/api/v1/dashboard/upsells', ['name' => 'x'])->assertForbidden()->assertJsonPath('code', 'plan_feature_locked')->assertJsonPath('upgrade_to.key', 'pro');
    $this->postJson("/api/v1/dashboard/upsells/{$upsell->id}/toggle")->assertOk()->assertJsonPath('data.is_active', false);
    $this->postJson("/api/v1/dashboard/upsells/{$upsell->id}/toggle")->assertForbidden();
    $this->getJson('/api/v1/dashboard/upsells')->assertOk();
});

it('locks per-page analytics on basic and keeps the overview', function () {
    planOwner('basic');

    $this->getJson('/api/v1/dashboard/analytics')->assertForbidden()->assertJsonPath('feature', 'advanced_analytics');
    $this->getJson('/api/v1/dashboard/overview')->assertOk();
});

it('shows the platform badge unless the plan removes it', function (string $plan, bool $branding) {
    $tenant = Tenant::factory()->onPlan($plan)->create();
    Domain::factory()->for($tenant)->create(['host' => 'b.localhost', 'active_host' => 'b.localhost']);
    planSitePage($tenant, 'b.localhost');

    planPublic('pages', ['host' => 'b.localhost', 'slug' => 'offer'])->assertOk()->assertJsonPath('data.branding', $branding);
})->with([['basic', true], ['pro', true], ['max', false]]);

// --- expired --------------------------------------------------------------------------------

it('makes the dashboard read-only when the plan expired', function () {
    planOwner('pro', expired: true);

    $this->getJson('/api/v1/dashboard/products')->assertOk();
    $this->postJson('/api/v1/dashboard/products', ['name' => 'x', 'price' => 10])->assertForbidden()->assertJsonPath('code', 'subscription_expired');
    $this->patchJson('/api/v1/dashboard/profile', ['name' => 'New Name'])->assertOk();
});

it('closes every public site of an expired store like a suspended one', function () {
    $tenant = Tenant::factory()->expired('pro')->create();
    Domain::factory()->for($tenant)->create(['host' => 'x.localhost', 'active_host' => 'x.localhost']);
    planSitePage($tenant, 'x.localhost');

    planPublic('resolve-host', ['host' => 'x.localhost'])->assertOk()->assertJsonPath('data.status', 'suspended');
    planPublic('pages', ['host' => 'x.localhost', 'slug' => 'offer'])->assertNotFound();
});

it('keeps sites open during the grace hours', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $tenant->forceFill(['plan_ends_at' => now()->subHour(), 'plan_grace_ends_at' => now()->addHours(20)])->save();
    Domain::factory()->for($tenant)->create(['host' => 'g.localhost', 'active_host' => 'g.localhost']);
    planSitePage($tenant, 'g.localhost');

    planPublic('pages', ['host' => 'g.localhost', 'slug' => 'offer'])->assertOk();
});

// --- locks after a downgrade -------------------------------------------------------------

it('locks the oldest pages above the new limit and keeps their status', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    Domain::factory()->for($tenant)->create(['host' => 'd.localhost', 'active_host' => 'd.localhost']);
    $pages = collect(range(1, 5))->map(fn (int $i) => tap(planSitePage($tenant, 'd.localhost', ['slug' => "p{$i}"]), fn ($p) => $p->forceFill(['updated_at' => now()->subDays(10 - $i)])->saveQuietly()));

    app(SubscriptionManager::class)->grant($tenant, 'basic', 30, null, null);

    $locked = asTenant($tenant, fn () => LandingPage::query()->where('locked_by_plan', true)->orderBy('id')->pluck('slug')->all());
    expect($locked)->toBe(['p1', 'p2'])
        ->and(asTenant($tenant, fn () => LandingPage::query()->where('status', 'published')->count()))->toBe(5);
    planPublic('pages', ['host' => 'd.localhost', 'slug' => 'p1'])->assertNotFound();
    planPublic('pages', ['host' => 'd.localhost', 'slug' => 'p5'])->assertOk();

    // Upgrading brings every page back.
    app(SubscriptionManager::class)->grant($tenant, 'pro', 30, null, null);
    expect(asTenant($tenant, fn () => LandingPage::query()->where('locked_by_plan', true)->count()))->toBe(0);
    planPublic('pages', ['host' => 'd.localhost', 'slug' => 'p1'])->assertOk();
});

it('lets the merchant choose which pages stay live within the limit', function () {
    $owner = planOwner('basic');
    $pages = asTenant($owner, fn () => LandingPage::factory()->count(4)->create());
    app(PlanLocks::class)->sync($owner->tenant->fresh());

    app(PlanLocks::class)->choose($owner->tenant->fresh(), PlanLimit::LandingPages, [$pages[0]->id, $pages[1]->id, $pages[2]->id]);

    expect(asTenant($owner, fn () => LandingPage::query()->where('locked_by_plan', true)->pluck('id')->all()))->toBe([$pages[3]->id]);
});

it('refuses to choose more than the limit or rows of another store', function () {
    $owner = planOwner('basic');
    $mine = asTenant($owner, fn () => LandingPage::factory()->count(2)->create());
    $other = asTenant(Tenant::factory()->create(), fn () => LandingPage::factory()->create());
    $locks = app(PlanLocks::class);

    expect(fn () => $locks->choose($owner->tenant->fresh(), PlanLimit::LandingPages, [$mine[0]->id, $other->id]))
        ->toThrow(ApiException::class);
    expect(fn () => $locks->choose($owner->tenant->fresh(), PlanLimit::Offers, range(1, 3)))
        ->toThrow(ApiException::class);
});

it('blocks publishing a locked page', function () {
    $owner = planOwner('basic');
    $page = planSitePage($owner->tenant, 'unused', ['status' => 'draft', 'published_content' => null]);
    asTenant($owner, fn () => $page->forceFill(['locked_by_plan' => true])->saveQuietly());

    $this->postJson("/api/v1/dashboard/pages/{$page->id}/publish")->assertStatus(422)->assertJsonPath('blockers.0.code', 'locked_by_plan');
});

it('hides pages of a locked product', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();
    Domain::factory()->for($tenant)->create(['host' => 'lp.localhost', 'active_host' => 'lp.localhost']);
    $page = planSitePage($tenant, 'lp.localhost');
    asTenant($tenant, fn () => Product::query()->whereKey($page->product_id)->update(['locked_by_plan' => true]));

    planPublic('pages', ['host' => 'lp.localhost', 'slug' => 'offer'])->assertNotFound();
});

it('stops serving a locked custom domain and hands primary back to the subdomain', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $sub = Domain::factory()->for($tenant)->create(['host' => 's.localhost', 'active_host' => 's.localhost', 'is_primary' => false]);
    asTenant($tenant, fn () => Domain::query()->create([
        'host' => 'brand.com', 'active_host' => 'brand.com', 'type' => DomainType::Custom, 'status' => DomainStatus::Active, 'is_primary' => true,
    ]));
    planSitePage($tenant, 'brand.com');
    planPublic('resolve-host', ['host' => 'brand.com'])->assertOk();

    app(SubscriptionManager::class)->grant($tenant, 'basic', 30, null, null);

    planPublic('resolve-host', ['host' => 'brand.com'])->assertNotFound();
    expect($sub->fresh()->is_primary)->toBeTrue();
    planPublic('resolve-host', ['host' => 's.localhost'])->assertOk()->assertJsonPath('data.is_primary', true);
});

it('does not apply locked offers or codes and does not deliver locked webhooks', function () {
    $tenant = Tenant::factory()->onPlan('basic')->create();
    asTenant($tenant, function () {
        $offer = Offer::factory()->create();
        DiscountCode::factory()->create(['code' => 'LOCKED']);
        Webhook::query()->create(['kind' => 'webhook', 'name' => 'w', 'url' => 'https://hooks.example.com/x', 'events' => ['order.created'], 'secret' => str_repeat('a', 48), 'is_active' => true]);
        foreach ([Offer::query(), DiscountCode::query(), Webhook::query()] as $query) {
            $query->update(['locked_by_plan' => true]);
        }

        expect(Offer::query()->servable()->whereKey($offer->id)->exists())->toBeFalse()
            ->and(DiscountCode::query()->servable()->where('code', 'LOCKED')->exists())->toBeFalse()
            ->and(Webhook::query()->servable()->count())->toBe(0);
    });
});

it('skips locked running A/B tests in the public routes', function () {
    $tenant = Tenant::factory()->onPlan('pro')->create();
    Domain::factory()->for($tenant)->create(['host' => 'ab.localhost', 'active_host' => 'ab.localhost']);
    $product = asTenant($tenant, fn () => Product::factory()->create());
    $a = planSitePage($tenant, 'ab.localhost', ['slug' => 'a', 'product' => $product]);
    $b = planSitePage($tenant, 'ab.localhost', ['slug' => 'b', 'product' => $product]);
    asTenant($tenant, fn () => AbTest::query()->create(['name' => 't', 'page_a_id' => $a->id, 'page_b_id' => $b->id, 'split_a' => 50, 'status' => AbTestStatus::Running, 'started_at' => now()]));
    asTenant($tenant, fn () => AbTest::query()->update(['locked_by_plan' => true]));

    planPublic('ab-routes', ['host' => 'ab.localhost'])->assertOk()->assertJsonPath('data', []);
});
