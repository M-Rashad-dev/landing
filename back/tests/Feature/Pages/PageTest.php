<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Theme;
use Database\Factories\LandingPageFactory;
use Database\Seeders\ThemeSeeder;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    $this->seed(ThemeSeeder::class);
    $this->user = actingAsOwner();
    $this->identity = asTenant($this->user, fn () => Identity::factory()->default()->create());
    $this->product = asTenant($this->user, fn () => Product::factory()->create());
});

function starter(): array
{
    return ['version' => 1, 'sections' => [
        LandingPageFactory::section('header', [], true, 'centered-logo'),
        LandingPageFactory::section('hero', ['title' => 'أهلًا', 'cta_url' => '#order'], true, 'split'),
        LandingPageFactory::section('order_form', ['title' => 'اطلب الآن'], true, 'card'),
        LandingPageFactory::section('footer', [], true, 'simple-center'),
    ]];
}

function createPage(array $overrides = []): array
{
    return test()->postJson('/api/v1/dashboard/pages', array_merge([
        'title' => 'صفحة العرض',
        'slug' => 'عرض-خاص',
        'theme_key' => 'malak',
        'product_id' => test()->product->id,
        'content' => starter(),
    ], $overrides))->assertCreated()->json('data');
}

it('lists active themes', function () {
    Theme::query()->where('key', 'celia')->update(['is_active' => false]);

    $this->getJson('/api/v1/dashboard/themes')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.key', 'malak')->assertJsonPath('data.1.key', 'layali');
});

it('creates a page with the default identity and starter content', function () {
    $page = createPage();

    expect($page['status'])->toBe('draft')
        ->and($page['identity_id'])->toBe($this->identity->id)
        ->and($page['version'])->toBe(1)
        ->and($page['is_home'])->toBeFalse()
        ->and(count($page['draft_content']['sections']))->toBe(4);
});

it('validates slugs', function (string $slug) {
    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => $slug, 'theme_key' => 'malak'])
        ->assertStatus(422)->assertJsonValidationErrors('slug');
})->with(['a', 'two--dashes', '-start', 'end-', 'with space', 'admin', 'thank-you', 'x/y', 'emoji🙂']);

it('accepts arabic and latin slugs', function (string $slug) {
    createPage(['slug' => $slug]);
})->with(['offer', 'عرض', 'عرض-رمضان-2026', 'summer-sale']);

it('lowercases slugs', function () {
    expect(createPage(['slug' => 'Summer-Sale'])['slug'])->toBe('summer-sale');
});

it('keeps slugs unique per tenant and frees them on delete', function () {
    $page = createPage(['slug' => 'sale']);
    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'sale', 'theme_key' => 'malak'])->assertStatus(422)->assertJsonValidationErrors('slug');

    $this->deleteJson("/api/v1/dashboard/pages/{$page['id']}")->assertNoContent();
    expect(LandingPage::withTrashed()->withoutGlobalScopes()->find($page['id'])->slug)->toBe("sale--deleted-{$page['id']}");

    createPage(['slug' => 'sale']);
});

it('allows the same slug in another tenant', function () {
    asTenant(createOwner(), fn () => LandingPage::factory()->create(['slug' => 'sale']));

    createPage(['slug' => 'sale']);
});

it('rejects inactive themes and identities/products of another tenant', function () {
    Theme::query()->where('key', 'celia')->update(['is_active' => false]);
    $foreignProduct = Product::factory()->create();
    $foreignIdentity = Identity::factory()->create();

    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'x1', 'theme_key' => 'celia'])->assertStatus(422)->assertJsonValidationErrors('theme_key');
    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'x2', 'theme_key' => 'malak', 'product_id' => $foreignProduct->id])->assertStatus(422)->assertJsonValidationErrors('product_id');
    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'x3', 'theme_key' => 'malak', 'identity_id' => $foreignIdentity->id])->assertStatus(422)->assertJsonValidationErrors('identity_id');
});

it('saves content with optimistic locking', function () {
    $page = createPage();

    $saved = $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => 1, 'content' => starter(), 'theme_key' => 'celia'])
        ->assertOk()->json('data');
    expect($saved['version'])->toBe(2)->and($saved['theme_key'])->toBe('celia');

    $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => 1, 'content' => starter()])
        ->assertStatus(409)
        ->assertJsonPath('code', 'version_conflict')
        ->assertJsonPath('current.version', 2);
});

it('reports content errors with the exact path', function () {
    $page = createPage();
    $content = starter();
    $content['sections'][1]['props']['cta_url'] = 'javascript:alert(1)';

    $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => 1, 'content' => $content])
        ->assertStatus(422)
        ->assertJsonValidationErrors('content.sections.1.props.cta_url');
});

it('reports every publish blocker at once', function () {
    $page = createPage(['product_id' => null, 'content' => ['version' => 1, 'sections' => [LandingPageFactory::section('hero', [], false)]]]);

    $codes = collect($this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")
        ->assertStatus(422)
        ->assertJsonPath('code', 'publish_blocked')
        ->json('blockers'))->pluck('code')->all();

    expect($codes)->toBe(['no_product', 'order_form_missing', 'no_visible_sections']);
});

it('blocks publishing with an inactive product or two forms', function () {
    $page = createPage();
    $this->product->update(['is_active' => false]);
    $content = starter();
    $content['sections'][] = LandingPageFactory::section('order_form');
    DB::table('landing_pages')->where('id', $page['id'])->update(['draft_content' => json_encode($content)]);

    $codes = collect($this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertStatus(422)->json('blockers'))->pluck('code')->all();

    expect($codes)->toContain('product_inactive')
        ->and(array_intersect($codes, ['order_form_multiple', 'content_invalid']))->not->toBe([]);
});

it('keeps pages on a disabled theme working but refuses it for new pages and switches', function () {
    $page = createPage(['theme_key' => 'celia']);
    Theme::query()->where('key', 'celia')->update(['is_active' => false]);

    $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => 1, 'content' => starter(), 'theme_key' => 'celia'])->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();

    $this->postJson('/api/v1/dashboard/pages', ['title' => 'جديدة', 'slug' => 'new-one', 'theme_key' => 'celia'])->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
    $other = createPage(['slug' => 'other']);
    $this->putJson("/api/v1/dashboard/pages/{$other['id']}/content", ['version' => 1, 'content' => starter(), 'theme_key' => 'celia'])->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
});

it('does not count a hidden order form', function () {
    $content = starter();
    $content['sections'][2]['visible'] = false;
    $page = createPage(['content' => $content]);

    $codes = collect($this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertStatus(422)->json('blockers'))->pluck('code')->all();
    expect($codes)->toBe(['order_form_missing']);
});

it('publishes a snapshot that later draft edits do not change', function () {
    $page = createPage();
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();

    $content = starter();
    $content['sections'][1]['props']['title'] = 'مسودة جديدة';
    $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => 1, 'content' => $content, 'theme_key' => 'celia'])
        ->assertOk()->assertJsonPath('data.has_unpublished_changes', true)->assertJsonPath('data.published_theme_key', 'malak');

    $model = asTenant($this->user, fn () => LandingPage::query()->findOrFail($page['id']));
    expect($model->published_content['sections'][1]['props']['title'])->toBe('أهلًا')
        ->and($model->published_content['theme_key'])->toBe('malak');
});

it('unpublishes and clears the home flag', function () {
    $page = createPage();
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/set-home")->assertOk()->assertJsonPath('data.is_home', true);

    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/unpublish")->assertOk()
        ->assertJsonPath('data.status', 'draft')
        ->assertJsonPath('data.is_home', false);
});

it('keeps a single home page and requires it to be published', function () {
    $a = createPage(['slug' => 'a-page']);
    $b = createPage(['slug' => 'b-page']);

    $this->postJson("/api/v1/dashboard/pages/{$a['id']}/set-home")->assertStatus(422);

    $this->postJson("/api/v1/dashboard/pages/{$a['id']}/publish")->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$b['id']}/publish")->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$a['id']}/set-home")->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$b['id']}/set-home")->assertOk();

    $homes = asTenant($this->user, fn () => LandingPage::query()->where('is_home', true)->pluck('id')->all());
    expect($homes)->toBe([$b['id']]);
});

it('makes the first published page home when none is set, and passes it on', function () {
    $a = createPage(['slug' => 'a-page']);
    $b = createPage(['slug' => 'b-page']);
    $c = createPage(['slug' => 'c-page']);
    $home = fn () => asTenant($this->user, fn () => LandingPage::query()->where('home_key', 1)->pluck('id')->all());

    $this->postJson("/api/v1/dashboard/pages/{$a['id']}/publish")->assertOk()->assertJsonPath('data.is_home', true);
    $this->postJson("/api/v1/dashboard/pages/{$b['id']}/publish")->assertOk()->assertJsonPath('data.is_home', false);
    expect($home())->toBe([$a['id']]);

    // The chosen home is respected; losing it hands home to the earliest remaining published page.
    $this->postJson("/api/v1/dashboard/pages/{$c['id']}/publish")->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$c['id']}/set-home")->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$c['id']}/unpublish")->assertOk();
    expect($home())->toBe([$a['id']]);

    $this->deleteJson("/api/v1/dashboard/pages/{$a['id']}")->assertNoContent();
    expect($home())->toBe([$b['id']]);

    $this->postJson("/api/v1/dashboard/pages/{$b['id']}/unpublish")->assertOk();
    expect($home())->toBe([]);
});

it('duplicates a page as a draft with a free slug', function () {
    $page = createPage(['slug' => 'offer']);
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();

    $copy = $this->postJson("/api/v1/dashboard/pages/{$page['id']}/duplicate")->assertCreated()->json('data');
    $copy2 = $this->postJson("/api/v1/dashboard/pages/{$page['id']}/duplicate")->assertCreated()->json('data');

    expect($copy['slug'])->toBe('offer-copy')
        ->and($copy2['slug'])->toBe('offer-copy-2')
        ->and($copy['status'])->toBe('draft')
        ->and($copy['title'])->toBe('صفحة العرض (نسخة)')
        ->and($copy['draft_content'])->toBe($page['draft_content']);
});

it('updates settings, seo and tracking overrides', function () {
    $page = createPage();
    $og = asTenant($this->user, fn () => Media::factory()->create());

    $this->putJson("/api/v1/dashboard/pages/{$page['id']}", [
        'title' => 'جديد',
        'slug' => 'new-slug',
        'identity_id' => $this->identity->id,
        'product_id' => null,
        'seo_override' => ['title' => 'عنوان', 'description' => 'وصف', 'og_media_id' => $og->id, 'noindex' => true],
        'tracking_override' => ['meta_pixel_id' => '1234567890', 'ga4_id' => 'g-abc123'],
    ])->assertOk()
        ->assertJsonPath('data.slug', 'new-slug')
        ->assertJsonPath('data.product_id', null)
        ->assertJsonPath('data.seo_override.noindex', true)
        ->assertJsonPath('data.tracking_override', ['meta_pixel_id' => '1234567890', 'ga4_id' => 'G-ABC123']);

    $this->putJson("/api/v1/dashboard/pages/{$page['id']}", [
        'title' => 'x', 'slug' => 'new-slug', 'identity_id' => $this->identity->id,
        'tracking_override' => ['meta_pixel_id' => '"><script>'],
    ])->assertStatus(422)->assertJsonValidationErrors('tracking_override.meta_pixel_id');
});

it('syncs landing_page_media and blocks deleting used media', function () {
    $hero = asTenant($this->user, fn () => Media::factory()->create());
    $gallery = asTenant($this->user, fn () => Media::factory()->create());
    $content = starter();
    $content['sections'][1]['props']['image_media_id'] = $hero->id;
    $content['sections'][] = LandingPageFactory::section('gallery', ['image_media_ids' => [$gallery->id]]);
    $page = createPage(['content' => $content]);

    $linked = DB::table('landing_page_media')->where('landing_page_id', $page['id'])->pluck('media_id')->sort()->values()->all();
    expect($linked)->toBe(collect([$hero->id, $gallery->id])->sort()->values()->all());

    $this->deleteJson("/api/v1/dashboard/media/{$hero->id}")->assertStatus(409)->assertJsonPath('usages.0.type', 'page');

    $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => 1, 'content' => starter()])->assertOk();
    $this->deleteJson("/api/v1/dashboard/media/{$gallery->id}")->assertNoContent();
});

it('blocks deleting products and identities used by pages', function () {
    $page = createPage();
    $other = asTenant($this->user, fn () => Identity::factory()->create());
    $this->putJson("/api/v1/dashboard/pages/{$page['id']}", ['title' => 'x', 'slug' => 'x-page', 'identity_id' => $other->id, 'product_id' => $this->product->id])->assertOk();

    $this->deleteJson("/api/v1/dashboard/products/{$this->product->id}")->assertStatus(409)->assertJsonPath('pages.0.id', $page['id']);
    $this->deleteJson("/api/v1/dashboard/identities/{$other->id}")->assertStatus(409)->assertJsonPath('pages.0.id', $page['id']);
});

it('returns preview data with public shapes and active + upcoming offers only', function () {
    $page = createPage();
    asTenant($this->user, function () {
        $attach = fn ($offer) => $offer->products()->attach($this->product->id, ['tenant_id' => $this->user->tenant_id]);
        $attach(Offer::factory()->create(['name' => 'active']));
        $attach(Offer::factory()->create(['name' => 'soon', 'starts_at' => now()->addDay()]));
        $attach(Offer::factory()->create(['name' => 'old', 'ends_at' => now()->subDay()]));
        $attach(Offer::factory()->create(['name' => 'off', 'is_active' => false]));
        Offer::factory()->create(['name' => 'other product']);
    });

    $data = $this->getJson("/api/v1/dashboard/pages/{$page['id']}/preview")->assertOk()->json('data');

    expect(collect($data['offers'])->pluck('status', 'name')->all())->toBe(['active' => 'active', 'soon' => 'scheduled'])
        ->and($data['product'])->not->toHaveKey('sku')
        ->and($data['identity'])->toHaveKeys(['brand_name', 'colors', 'contact', 'socials'])
        ->and($data['identity'])->not->toHaveKey('tracking')
        ->and($data['content']['sections'])->toHaveCount(4);
});

it('enforces the pages limit', function () {
    config(['landing.limits.pages' => 1]);
    createPage();

    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'another', 'theme_key' => 'malak'])->assertStatus(422)->assertJsonPath('code', 'limit_reached');
});

it('filters the list by status and search', function () {
    $a = createPage(['slug' => 'alpha', 'title' => 'ألفا']);
    createPage(['slug' => 'beta', 'title' => 'بيتا']);
    $this->postJson("/api/v1/dashboard/pages/{$a['id']}/publish")->assertOk();

    $this->getJson('/api/v1/dashboard/pages?status=published')->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', 'alpha');
    $this->getJson('/api/v1/dashboard/pages?q=beta')->assertJsonCount(1, 'data');
    $this->getJson('/api/v1/dashboard/pages')->assertJsonMissingPath('data.0.draft_content');
});

it('keeps a page-only design in the content and publishes it', function () {
    $page = createPage();
    $design = [
        'colors' => ['primary' => '#0f766e', 'secondary' => '#F0FDFA', 'accent' => '#F59E0B', 'background' => '#FFFFFF', 'foreground' => '#111827', 'muted' => '#6B7280', 'border' => '#E5E7EB'],
        'font_heading' => 'readex_pro',
        'font_body' => 'tajawal',
        'button_radius' => 'full',
    ];
    $content = starter() + ['design' => $design];

    $saved = $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => 1, 'content' => $content])->assertOk();
    expect($saved->json('data.draft_content.design.colors.primary'))->toBe('#0F766E')
        ->and($saved->json('data.draft_content.design.font_body'))->toBe('tajawal');

    // Bad values are refused with paths under content.design.
    $bad = $content;
    $bad['design']['colors']['primary'] = 'red';
    $bad['design']['font_body'] = 'comic_sans';
    $bad['design']['extra'] = 1;
    $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => $saved->json('data.version'), 'content' => $bad])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['content.design.colors.primary', 'content.design.font_body', 'content.design']);

    // Publishing carries it to the public API.
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();
    $host = asTenant($this->user, fn () => Domain::query()->value('host'));
    $this->getJson("/api/v1/public/pages?host={$host}&slug=".rawurlencode($page['slug']), internalHeaders())
        ->assertOk()
        ->assertJsonPath('data.content.design.button_radius', 'full');
});
