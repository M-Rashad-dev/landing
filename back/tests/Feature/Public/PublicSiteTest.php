<?php

declare(strict_types=1);

use App\Enums\DomainStatus;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Tenant;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->create();
    $this->domain = Domain::factory()->for($this->tenant)->create(['host' => 'rashad.localhost', 'active_host' => 'rashad.localhost']);
    $this->identity = asTenant($this->tenant, fn () => Identity::factory()->default()->create([
        'brand_name' => 'متجر رشاد',
        'seo_title' => 'عنوان الهوية',
        'seo_title_suffix' => '| متجر رشاد',
        'seo_description' => 'وصف الهوية',
        'tracking' => ['meta_pixel_id' => '1234567890', 'ga4_id' => 'G-ABC1234', 'conversion_event' => 'Purchase'],
    ]));
    $this->product = asTenant($this->tenant, fn () => Product::factory()->create(['name' => 'ساعة ذكية', 'sku' => 'SECRET-SKU', 'description' => '**ساعة** رائعة']));
});

function publishedPage(Tenant $tenant, array $attributes = [], string $heroTitle = 'العنوان المنشور'): LandingPage
{
    return asTenant($tenant, fn () => LandingPage::factory()
        ->withSections([
            LandingPageFactory::section('hero', ['title' => $heroTitle], true, 'split'),
            LandingPageFactory::section('order_form', [], true, 'card'),
        ])
        ->published()
        ->create(array_merge(['slug' => 'offer', 'identity_id' => test()->identity->id ?? null, 'product_id' => test()->product->id ?? null], $attributes)));
}

function publicGet(string $path, array $query): TestResponse
{
    return test()->getJson('/api/v1/public/'.$path.'?'.http_build_query($query), internalHeaders());
}

it('requires the internal key', function () {
    $this->getJson('/api/v1/public/resolve-host?host=rashad.localhost')->assertUnauthorized();
    $this->getJson('/api/v1/public/resolve-host?host=rashad.localhost', ['X-Internal-Key' => 'wrong'])->assertUnauthorized();
    $this->getJson('/api/v1/public/pages?host=rashad.localhost', ['X-Internal-Key' => 'wrong'])->assertUnauthorized();
});

it('resolves an active primary host', function () {
    publishedPage($this->tenant, ['slug' => 'home-page', 'is_home' => true, 'home_key' => 1]);

    publicGet('resolve-host', ['host' => 'RASHAD.localhost'])
        ->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.primary_host', 'rashad.localhost')
        ->assertJsonPath('data.is_primary', true)
        ->assertJsonPath('data.home_slug', 'home-page');
});

it('returns 404 for unknown hosts and pending custom domains', function () {
    asTenant($this->tenant, fn () => Domain::factory()->custom('shop.example.com', DomainStatus::Pending)->create());

    publicGet('resolve-host', ['host' => 'nobody.localhost'])->assertNotFound()->assertJsonPath('code', 'site_not_found');
    publicGet('resolve-host', ['host' => 'shop.example.com'])->assertNotFound();
    publicGet('pages', ['host' => 'shop.example.com', 'slug' => 'offer'])->assertNotFound();
    publicGet('resolve-host', ['host' => ''])->assertNotFound();
});

it('points active secondary hosts to the primary one', function () {
    asTenant($this->tenant, fn () => Domain::factory()->custom('shop.example.com', DomainStatus::Active)->create());

    publicGet('resolve-host', ['host' => 'shop.example.com'])
        ->assertOk()
        ->assertJsonPath('data.is_primary', false)
        ->assertJsonPath('data.primary_host', 'rashad.localhost');
});

it('reports suspended tenants and serves them no pages', function () {
    publishedPage($this->tenant);
    $this->tenant->update(['status' => 'suspended']);

    publicGet('resolve-host', ['host' => 'rashad.localhost'])->assertOk()->assertJsonPath('data.status', 'suspended')->assertJsonPath('data.home_slug', null);
    publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->assertNotFound();
    publicGet('sitemap', ['host' => 'rashad.localhost'])->assertNotFound();
});

it('never serves drafts', function () {
    asTenant($this->tenant, fn () => LandingPage::factory()->create(['slug' => 'draft-only']));

    publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'draft-only'])->assertNotFound()->assertJsonPath('code', 'page_not_found');
});

it('serves the published snapshot, not later draft edits', function () {
    $page = publishedPage($this->tenant);
    asTenant($this->tenant, fn () => $page->update([
        'draft_content' => ['version' => 1, 'sections' => [LandingPageFactory::section('hero', ['title' => 'مسودة جديدة'], true, 'split')]],
        'theme_key' => 'celia',
    ]));

    $response = publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->assertOk();

    expect($response->json('data.content.sections.0.props.title'))->toBe('العنوان المنشور')
        ->and($response->json('data.theme_key'))->toBe('malak')
        ->and($response->json('data.page.slug'))->toBe('offer')
        ->and($response->json('data.content'))->not->toHaveKey('theme_key')
        ->and($response->getContent())->not->toContain('مسودة جديدة');
});

it('serves the home page for an empty slug', function () {
    publishedPage($this->tenant, ['slug' => 'main', 'is_home' => true, 'home_key' => 1], 'الرئيسية');

    publicGet('pages', ['host' => 'rashad.localhost', 'slug' => ''])->assertOk()->assertJsonPath('data.content.sections.0.props.title', 'الرئيسية');
    publicGet('pages', ['host' => 'rashad.localhost'])->assertOk()->assertJsonPath('data.page.is_home', true);
});

it('returns identity, product, offers and media without internal fields', function () {
    asTenant($this->tenant, fn () => Offer::factory()->percentage(10)->forProduct($this->product)->create());
    publishedPage($this->tenant);

    $response = publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->assertOk();
    $body = $response->getContent();

    expect($response->json('data.identity.brand_name'))->toBe('متجر رشاد')
        ->and($response->json('data.product.name'))->toBe('ساعة ذكية')
        ->and($response->json('data.product.available'))->toBeTrue()
        ->and($response->json('data.offers'))->toHaveCount(1);

    foreach (['tenant_id', 'draft_content', 'SECRET-SKU', '"sku"', 'created_by', 'tracking_override', 'seo_override', '"is_default"'] as $leak) {
        expect($body)->not->toContain($leak);
    }
});

it('marks an inactive product as unavailable', function () {
    publishedPage($this->tenant);
    asTenant($this->tenant, fn () => $this->product->update(['is_active' => false]));

    publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->assertOk()->assertJsonPath('data.product.available', false);
});

it('isolates tenants that use the same slug', function () {
    publishedPage($this->tenant, [], 'صفحة رشاد');

    $other = Tenant::factory()->create();
    Domain::factory()->for($other)->create(['host' => 'other.localhost', 'active_host' => 'other.localhost']);
    asTenant($other, fn () => LandingPage::factory()
        ->withSections([LandingPageFactory::section('hero', ['title' => 'صفحة أخرى'], true, 'split')])
        ->published()
        ->create(['slug' => 'offer']));

    publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->assertOk()->assertJsonPath('data.content.sections.0.props.title', 'صفحة رشاد');
    publicGet('pages', ['host' => 'other.localhost', 'slug' => 'offer'])->assertOk()->assertJsonPath('data.content.sections.0.props.title', 'صفحة أخرى');
});

it('merges SEO: page override, then identity, then product', function () {
    config(['landing.public_scheme' => 'https', 'landing.public_port' => null]);
    $page = publishedPage($this->tenant);

    $seo = publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->json('data.seo');
    expect($seo['title'])->toBe('عنوان الهوية | متجر رشاد')
        ->and($seo['description'])->toBe('وصف الهوية')
        ->and($seo['canonical'])->toBe('https://rashad.localhost/offer')
        ->and($seo['noindex'])->toBeFalse();

    asTenant($this->tenant, fn () => $page->update(['seo_override' => ['title' => 'عنوان الصفحة', 'description' => 'وصف الصفحة', 'noindex' => true]]));
    $seo = publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->json('data.seo');
    expect($seo['title'])->toBe('عنوان الصفحة | متجر رشاد')->and($seo['description'])->toBe('وصف الصفحة')->and($seo['noindex'])->toBeTrue();

    asTenant($this->tenant, fn () => $this->identity->update(['seo_title' => null, 'seo_title_suffix' => null, 'seo_description' => null]));
    asTenant($this->tenant, fn () => $page->update(['seo_override' => null]));
    $seo = publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->json('data.seo');
    expect($seo['title'])->toBe('ساعة ذكية')->and($seo['description'])->toBe('ساعة رائعة');
});

it('uses the primary host for canonical URLs', function () {
    config(['landing.public_scheme' => 'https', 'landing.public_port' => null]);
    asTenant($this->tenant, fn () => Domain::factory()->custom('shop.example.com', DomainStatus::Active)->create());
    publishedPage($this->tenant, ['slug' => 'main', 'is_home' => true, 'home_key' => 1]);

    publicGet('pages', ['host' => 'shop.example.com'])->assertOk()->assertJsonPath('data.seo.canonical', 'https://rashad.localhost/');
});

it('merges tracking with the page override on top and drops malformed ids', function () {
    $page = publishedPage($this->tenant);
    asTenant($this->tenant, fn () => $page->update(['tracking_override' => ['meta_pixel_id' => '9999999999', 'tiktok_pixel_id' => 'ABCDEFGHIJ12']]));
    // A value that bypassed validation (e.g. written by hand) must still never reach the page.
    asTenant($this->tenant, fn () => $this->identity->forceFill(['tracking' => ['ga4_id' => '"><script>', 'conversion_event' => 'Purchase']])->save());

    $tracking = publicGet('pages', ['host' => 'rashad.localhost', 'slug' => 'offer'])->json('data.tracking');

    expect($tracking['meta_pixel_id'])->toBe('9999999999')
        ->and($tracking['tiktok_pixel_id'])->toBe('ABCDEFGHIJ12')
        ->and($tracking['ga4_id'])->toBeNull()
        ->and($tracking['conversion_event'])->toBe('Purchase');
});

it('lists indexable published pages in the sitemap', function () {
    config(['landing.public_scheme' => 'https', 'landing.public_port' => null]);
    publishedPage($this->tenant, ['slug' => 'main', 'is_home' => true, 'home_key' => 1]);
    publishedPage($this->tenant, ['slug' => 'second']);
    publishedPage($this->tenant, ['slug' => 'hidden', 'seo_override' => ['noindex' => true]]);
    asTenant($this->tenant, fn () => LandingPage::factory()->create(['slug' => 'draft']));

    $data = publicGet('sitemap', ['host' => 'rashad.localhost'])->assertOk()->json('data');

    expect($data['primary_host'])->toBe('rashad.localhost')
        ->and(array_column($data['pages'], 'url'))->toBe(['https://rashad.localhost/', 'https://rashad.localhost/second']);
});
