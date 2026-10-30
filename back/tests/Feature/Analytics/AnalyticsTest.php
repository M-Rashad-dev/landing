<?php

declare(strict_types=1);

use App\Enums\OrderStatus;
use App\Models\AbTest;
use App\Models\Domain;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\PageStat;
use App\Models\Product;
use App\Services\FormToken;
use App\Services\PageAnalytics;
use App\Support\TrafficSource;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Testing\TestResponse;

const STATS_SHOP = 'stats.localhost';

beforeEach(function () {
    $this->seed(ThemeSeeder::class);
    $this->owner = createOwner();
    $this->tenant = $this->owner->tenant;
    Domain::factory()->for($this->tenant)->create(['host' => STATS_SHOP, 'active_host' => STATS_SHOP]);
    $this->product = asTenant($this->tenant, fn () => Product::factory()->create(['price' => '500.00']));
    $this->a = statsPage('offer-a');
    $this->b = statsPage('offer-b');
});

function statsPage(string $slug, ?int $productId = null, bool $published = true): LandingPage
{
    return asTenant(test()->tenant, function () use ($slug, $productId, $published) {
        $factory = LandingPage::factory()->withSections([
            LandingPageFactory::section('hero', ['title' => $slug]),
            LandingPageFactory::section('order_form', ['fields' => ['name' => ['enabled' => true, 'required' => true], 'phone' => ['enabled' => true, 'required' => true], 'phone2' => ['enabled' => false, 'required' => false], 'governorate' => ['enabled' => false, 'required' => false], 'city' => ['enabled' => false, 'required' => false], 'address' => ['enabled' => false, 'required' => false], 'notes' => ['enabled' => false, 'required' => false]], 'custom_fields' => []], true, 'card'),
        ]);

        return ($published ? $factory->published() : $factory)->create(['slug' => $slug, 'title' => "صفحة {$slug}", 'product_id' => $productId ?? test()->product->id]);
    });
}

function pageEvent(array $overrides = []): TestResponse
{
    return test()->postJson('/api/v1/public/events', array_merge(['host' => STATS_SHOP, 'slug' => 'offer-a', 'type' => 'view', 'utm_source' => 'facebook', 'referrer' => null, 'device' => 'mobile', 'ip' => '41.1.1.1'], $overrides), internalHeaders());
}

function pageStats(): array
{
    return asTenant(test()->tenant, fn () => PageStat::query()->orderBy('id')->get()->map(fn ($s) => [$s->landing_page_id, $s->ab_test_id, $s->source, $s->device, $s->views, $s->form_starts])->all());
}

function abTest(array $attributes = []): AbTest
{
    return asTenant(test()->tenant, fn () => AbTest::query()->create(array_merge(['name' => 'اختبار', 'page_a_id' => test()->a->id, 'page_b_id' => test()->b->id, 'split_a' => 50, 'status' => 'running', 'started_at' => now()], $attributes)));
}

it('counts views and form starts per page, source and device in one row per bucket', function () {
    pageEvent()->assertStatus(202);
    pageEvent()->assertStatus(202);
    pageEvent(['type' => 'form_start'])->assertStatus(202);
    pageEvent(['utm_source' => null, 'referrer' => 'https://www.google.com/search', 'device' => 'desktop'])->assertStatus(202);
    pageEvent(['slug' => 'offer-b', 'utm_source' => 'IG'])->assertStatus(202);

    expect(pageStats())->toBe([
        [$this->a->id, 0, 'facebook', 'mobile', 2, 1],
        [$this->a->id, 0, 'google', 'desktop', 1, 0],
        [$this->b->id, 0, 'instagram', 'mobile', 1, 0],
    ]);
});

it('validates events, needs the internal key and a published page', function () {
    $this->postJson('/api/v1/public/events', [], internalHeaders())->assertStatus(422)->assertJsonValidationErrors(['host', 'type']);
    pageEvent(['type' => 'click'])->assertStatus(422)->assertJsonValidationErrors(['type']);
    $this->postJson('/api/v1/public/events', ['host' => STATS_SHOP, 'slug' => 'offer-a', 'type' => 'view'])->assertUnauthorized();
    statsPage('draft-page', published: false);
    pageEvent(['slug' => 'draft-page'])->assertNotFound();
});

it('classifies traffic sources', function (?string $utm, ?string $referrer, string $source) {
    expect(TrafficSource::classify($utm, $referrer))->toBe($source);
})->with([
    ['fb', null, 'facebook'],
    ['Facebook_Ads', null, 'facebook'],
    ['tiktok', 'https://google.com', 'tiktok'],
    [null, 'https://l.instagram.com/', 'instagram'],
    [null, 'https://wa.me/2010', 'whatsapp'],
    [null, null, 'direct'],
    ['newsletter', null, 'other'],
    [null, 'https://example.com', 'other'],
]);

it('tags events and orders with a running test only when the page is in it', function () {
    $test = abTest();
    $other = statsPage('other');
    pageEvent(['ab' => $test->id])->assertStatus(202);
    pageEvent(['slug' => 'other', 'ab' => $test->id])->assertStatus(202);
    pageEvent(['ab' => 999999])->assertStatus(202);

    expect(array_column(pageStats(), 1))->toBe([$test->id, 0, 0]);

    $order = fn (string $slug, int $page) => $this->postJson('/api/v1/public/orders', [
        'host' => STATS_SHOP, 'slug' => $slug, 'quantity' => 1, 'options' => [], 'customer' => ['name' => 'عميل', 'phone' => '0101111222'.$page % 10],
        'answers' => [], 'form_token' => app(FormToken::class)->issue($page, time() - 10), 'website' => '', 'ab' => $test->id, 'ip' => '41.1.1.'.$page % 200,
    ], internalHeaders())->assertCreated();
    $order('offer-b', $this->b->id);
    $order('other', $other->id);

    expect(asTenant($this->tenant, fn () => Order::query()->orderBy('id')->pluck('ab_test_id')->all()))->toBe([$test->id, null]);
});

it('reports totals, conversion, daily series, pages and sources', function () {
    foreach (range(1, 4) as $_) {
        pageEvent();
    }
    pageEvent(['slug' => 'offer-b', 'utm_source' => null]);
    asTenant($this->tenant, function () {
        Order::factory()->create(['landing_page_id' => $this->a->id, 'total' => '500.00', 'utm' => ['source' => 'facebook']]);
        Order::factory()->create(['landing_page_id' => $this->a->id, 'total' => '250.50', 'status' => OrderStatus::Confirmed]);
        Order::factory()->create(['landing_page_id' => $this->a->id, 'total' => '999.00', 'status' => OrderStatus::Fake]);
    });
    actingAsOwner($this->owner);

    $response = $this->getJson('/api/v1/dashboard/analytics')->assertOk()
        ->assertJsonPath('data.totals.views', 5)
        ->assertJsonPath('data.totals.orders', 2)
        ->assertJsonPath('data.totals.revenue', 750.5)
        ->assertJsonPath('data.totals.conversion', 40)
        ->assertJsonPath('data.pages.0.id', $this->a->id)
        ->assertJsonPath('data.pages.0.conversion', 50)
        ->assertJsonPath('data.devices.mobile', 5)
        ->assertJsonCount(30, 'data.daily');
    expect(collect($response->json('data.daily'))->last())->toBe(['date' => now('Africa/Cairo')->toDateString(), 'views' => 5, 'orders' => 2])
        ->and(collect($response->json('data.sources'))->firstWhere('source', 'facebook'))->toBe(['source' => 'facebook', 'views' => 4, 'orders' => 1]);

    $this->getJson("/api/v1/dashboard/analytics?page_id={$this->b->id}")->assertOk()->assertJsonPath('data.totals.views', 1)->assertJsonPath('data.totals.orders', 0)->assertJsonPath('data.pages', []);
    $this->getJson('/api/v1/dashboard/analytics?from=2026-10-10&to=2026-10-01')->assertStatus(422)->assertJsonValidationErrors(['to']);
});

it('leaves orders of pages without tracked visits out of conversion', function () {
    pageEvent();
    pageEvent(['utm_source' => 'tiktok']);
    asTenant($this->tenant, function () {
        Order::factory()->create(['landing_page_id' => $this->a->id, 'total' => '500.00']);
        Order::factory()->count(3)->create(['landing_page_id' => $this->b->id, 'total' => '500.00']);
    });
    actingAsOwner($this->owner);

    $pages = collect($this->getJson('/api/v1/dashboard/analytics')->assertOk()
        ->assertJsonPath('data.totals.orders', 4)
        ->assertJsonPath('data.totals.conversion', 50)
        ->json('data.pages'))->keyBy('id');
    expect($pages[$this->b->id]['conversion'])->toBeNull()
        ->and($pages[$this->a->id]['conversion'])->toEqual(50);
    $this->getJson("/api/v1/dashboard/analytics?page_id={$this->b->id}")->assertJsonPath('data.totals.conversion', null);
});

it('creates tests between published pages of the same product only', function () {
    actingAsOwner($this->owner);
    $draft = statsPage('draft', published: false);
    $otherProduct = statsPage('other-product', asTenant($this->tenant, fn () => Product::factory()->create())->id);

    $this->postJson('/api/v1/dashboard/ab-tests', ['name' => 'x', 'page_a_id' => $this->a->id, 'page_b_id' => $draft->id, 'split_a' => 50])->assertStatus(422)->assertJsonPath('errors.page_b_id.0', __('analytics.page_not_published'));
    $this->postJson('/api/v1/dashboard/ab-tests', ['name' => 'x', 'page_a_id' => $this->a->id, 'page_b_id' => $otherProduct->id, 'split_a' => 50])->assertStatus(422)->assertJsonPath('errors.page_b_id.0', __('analytics.same_product'));
    $this->postJson('/api/v1/dashboard/ab-tests', ['name' => 'x', 'page_a_id' => $this->a->id, 'page_b_id' => $this->a->id, 'split_a' => 95])->assertStatus(422)->assertJsonValidationErrors(['page_b_id', 'split_a']);

    $id = $this->postJson('/api/v1/dashboard/ab-tests', ['name' => 'ملاك ضد سيليا', 'page_a_id' => $this->a->id, 'page_b_id' => $this->b->id, 'split_a' => 60])->assertCreated()
        ->assertJsonPath('data.status', 'running')
        ->assertJsonPath('data.results.verdict.state', 'collecting')
        ->json('data.id');
    $this->postJson('/api/v1/dashboard/ab-tests', ['name' => 'تاني', 'page_a_id' => $this->b->id, 'page_b_id' => statsPage('third')->id, 'split_a' => 50])->assertStatus(422)->assertJsonPath('errors.page_a_id.0', __('analytics.page_in_test'));

    $this->getJson('/api/v1/dashboard/ab-tests')->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.page_b.slug', 'offer-b');
});

it('gives the proxy the split, then routes the entry link to a B winner', function () {
    $test = abTest(['split_a' => 70]);
    asTenant($this->tenant, fn () => $this->a->forceFill(['is_home' => true, 'home_key' => 1])->save());

    $routes = fn () => $this->getJson('/api/v1/public/ab-routes?host='.STATS_SHOP, internalHeaders())->assertOk()->json('data');
    expect($routes())->toBe([['id' => $test->id, 'entries' => ['offer-a', ''], 'a' => 'offer-a', 'b' => 'offer-b', 'split_a' => 70]]);

    actingAsOwner($this->owner);
    $this->postJson("/api/v1/dashboard/ab-tests/{$test->id}/finish", ['winner_page_id' => 12345])->assertStatus(422);
    $this->postJson("/api/v1/dashboard/ab-tests/{$test->id}/finish", ['winner_page_id' => $this->b->id])->assertOk()->assertJsonPath('data.status', 'finished');
    expect($routes()[0]['split_a'])->toBe(0);
    $this->postJson("/api/v1/dashboard/ab-tests/{$test->id}/finish")->assertStatus(422);

    $this->deleteJson("/api/v1/dashboard/ab-tests/{$test->id}")->assertNoContent();
    expect($routes())->toBe([]);
    $this->getJson('/api/v1/public/ab-routes?host='.STATS_SHOP)->assertUnauthorized();
});

it('declares a winner only with enough visits and 95% confidence', function () {
    $analytics = app(PageAnalytics::class);
    expect($analytics->verdict(['views' => 50, 'orders' => 5], ['views' => 500, 'orders' => 50])['state'])->toBe('collecting')
        ->and($analytics->verdict(['views' => 1000, 'orders' => 20], ['views' => 1000, 'orders' => 23]))->toMatchArray(['state' => 'too_close', 'leader' => 'b'])
        ->and($analytics->verdict(['views' => 1000, 'orders' => 20], ['views' => 1000, 'orders' => 45]))->toMatchArray(['state' => 'winner', 'leader' => 'b', 'lift' => 125.0])
        ->and($analytics->verdict(['views' => 1000, 'orders' => 20], ['views' => 1000, 'orders' => 45])['confidence'])->toBeGreaterThanOrEqual(99);
});

it('keeps analytics and tests per store and needs a token', function () {
    $test = abTest();
    pageEvent();

    $this->getJson('/api/v1/dashboard/analytics')->assertUnauthorized();
    $this->getJson('/api/v1/dashboard/ab-tests')->assertUnauthorized();

    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/analytics')->assertOk()->assertJsonPath('data.totals.views', 0);
    $this->getJson("/api/v1/dashboard/analytics?page_id={$this->a->id}")->assertStatus(422);
    $this->getJson('/api/v1/dashboard/ab-tests')->assertOk()->assertJsonCount(0, 'data');
    $this->postJson("/api/v1/dashboard/ab-tests/{$test->id}/finish")->assertNotFound();
    $this->deleteJson("/api/v1/dashboard/ab-tests/{$test->id}")->assertNotFound();
    $this->postJson('/api/v1/dashboard/ab-tests', ['name' => 'x', 'page_a_id' => $this->a->id, 'page_b_id' => $this->b->id, 'split_a' => 50])->assertStatus(422)->assertJsonValidationErrors(['page_a_id', 'page_b_id']);
});
