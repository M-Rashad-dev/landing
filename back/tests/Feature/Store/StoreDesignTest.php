<?php

declare(strict_types=1);

use App\Models\Category;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

function designOwner(string $plan = 'pro'): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create();
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create(['host' => 'design-'.$tenant->id.'.localhost', 'active_host' => 'design-'.$tenant->id.'.localhost']);
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

/** The design as the Builder holds it, with changes on top. */
function designDraft(array $changes = []): array
{
    $draft = test()->getJson('/api/v1/dashboard/store/design')->assertOk()->json('data.draft');

    return array_replace_recursive($draft, $changes);
}

function saveDesign(array $draft, ?int $version = null)
{
    $version ??= test()->getJson('/api/v1/dashboard/store/design')->json('data.version');

    return test()->putJson('/api/v1/dashboard/store/design', ['draft' => $draft, 'version' => $version]);
}

it('opens «أساس» with the starter design in the mint colors and the four sections', function () {
    designOwner();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk()
        ->assertJsonPath('data.theme.key', 'asas')
        ->assertJsonPath('data.theme.name', 'أساس')
        ->assertJsonPath('data.draft.settings.colors.primary', '#0b875b')
        ->assertJsonPath('data.draft.settings.font', 'cairo')
        ->assertJsonPath('data.draft.settings.font_size', 'medium')
        ->assertJsonPath('data.published_at', null)
        ->assertJsonPath('data.has_unpublished_changes', true);
    expect(array_column($res->json('data.draft.sections'), 'type'))->toBe(['banner', 'products', 'features', 'testimonials'])
        // «آراء العملاء» automatic shows real reviews only: none yet.
        ->and($res->json('data.data.reviews'))->toBe([]);
});

it('saves the draft, shows each product list its products, and publishes', function () {
    $owner = designOwner();
    [$shoes, $old] = asTenant($owner, function () {
        $shoes = Category::query()->create(['name' => 'أحذية', 'slug' => 'shoes']);
        $sneaker = Product::factory()->create(['slug' => 'sneaker', 'price' => '500.00']);
        $sneaker->categories()->attach($shoes);
        Product::factory()->create(['slug' => 'sale', 'price' => '80.00', 'compare_at_price' => '100.00']);
        $old = Product::factory()->create(['slug' => 'with-offer', 'price' => '300.00']);
        Offer::factory()->create(['type' => 'percentage', 'value' => 10, 'applies_to' => 'products'])->products()->attach($old->id, ['tenant_id' => $old->tenant_id]);
        Product::factory()->count(3)->create();

        return [$shoes, $old];
    });

    $draft = designDraft();
    $draft['sections'][1]['props']['limit'] = 4;
    $draft['sections'][] = ['id' => 'offers-list', 'type' => 'products', 'visible' => true, 'props' => ['title' => 'عروض', 'description' => null, 'source' => 'offers', 'category_id' => null, 'limit' => 8, 'layout' => 'slider', 'columns' => 4, 'show_view_all' => true]];
    $draft['sections'][] = ['id' => 'shoes-list', 'type' => 'products', 'visible' => true, 'props' => ['title' => '<b>أحذية</b>', 'description' => null, 'source' => 'category', 'category_id' => $shoes->id, 'limit' => 8, 'layout' => 'grid', 'columns' => 3, 'show_view_all' => true]];
    $draft['settings']['colors']['primary'] = '#FF0055';
    $draft['settings']['header']['announcement'] = '  شحن مجاني  ';

    $latestId = $draft['sections'][1]['id'];
    $res = saveDesign($draft)->assertOk()
        ->assertJsonPath('data.draft.settings.colors.primary', '#ff0055')
        ->assertJsonPath('data.draft.settings.header.announcement', 'شحن مجاني')
        ->assertJsonPath('data.draft.sections.5.props.title', 'أحذية')
        ->assertJsonCount(4, "data.data.products.{$latestId}")
        ->assertJsonCount(1, 'data.data.products.shoes-list')
        ->assertJsonPath('data.data.view_all.shoes-list', '/categories/shoes')
        ->assertJsonPath('data.data.view_all.offers-list', '/offers');
    expect(array_column($res->json('data.data.products.offers-list'), 'slug'))->toEqualCanonicalizing(['sale', 'with-offer']);

    // Published = the draft; the store page sees it.
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk()->assertJsonPath('data.has_unpublished_changes', false)->assertJsonPath('data.published_at', fn ($v) => $v !== null);
    expect($old->id)->toBeInt();
});

it('resolves banner links and images', function () {
    $owner = designOwner();
    [$media, $product] = asTenant($owner, fn () => [Media::factory()->create(), Product::factory()->create(['slug' => 'watch'])]);

    $draft = designDraft();
    $draft['sections'][0]['props']['slides'] = [
        ['media_id' => $media->id, 'title' => 'العيد', 'text' => null, 'button_label' => 'اطلب', 'link' => ['type' => 'product', 'target_id' => $product->id, 'url' => null]],
        ['media_id' => $media->id, 'title' => null, 'text' => null, 'button_label' => null, 'link' => ['type' => 'url', 'target_id' => null, 'url' => 'https://example.com/eid']],
    ];
    $bannerId = $draft['sections'][0]['id'];
    saveDesign($draft)->assertOk()
        ->assertJsonPath("data.data.links.{$bannerId}:0", '/products/watch')
        ->assertJsonPath("data.data.links.{$bannerId}:1", 'https://example.com/eid')
        ->assertJsonPath("data.data.media.{$media->id}.thumb", fn ($url) => is_string($url));
});

it('validates the design with Arabic field names', function () {
    designOwner();
    $draft = designDraft();
    $draft['settings']['colors']['primary'] = 'green';
    $draft['settings']['font'] = 'comic';
    $draft['sections'][1]['props']['limit'] = 7;
    $draft['sections'][1]['props']['source'] = 'category';
    $draft['sections'][2]['props']['items'] = [['icon' => 'truck', 'title' => 'x', 'text' => null]];
    $draft['sections'][3]['props']['source'] = 'manual';
    $draft['sections'][0]['props']['slides'] = [['media_id' => 999999, 'link' => ['type' => 'url', 'url' => 'javascript:alert(1)']]];
    $draft['sections'][] = ['id' => $draft['sections'][1]['id'], 'type' => 'hero', 'visible' => true, 'props' => []];

    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors([
        'draft.settings.colors.primary',
        'draft.settings.font',
        'draft.sections.1.props.limit',
        'draft.sections.1.props.category_id',
        'draft.sections.2.props.items',
        'draft.sections.3.props.items',
        'draft.sections.0.props.slides.0.media_id',
        'draft.sections.0.props.slides.0.link.url',
        'draft.sections.4.type',
        'draft.sections.4.id',
    ]);
    expect(saveDesign(designDraft(['settings' => ['colors' => ['primary' => 'x']]]))->json('errors')['draft.settings.colors.primary'][0])->toContain('اللون الأساسي');
});

it('refuses a stale version instead of overwriting another tab', function () {
    designOwner();
    $draft = designDraft();
    $version = $this->getJson('/api/v1/dashboard/store/design')->json('data.version');
    saveDesign($draft, $version)->assertOk();
    saveDesign($draft, $version)->assertStatus(409)->assertJsonPath('code', 'design_changed');
});

it('keeps the Builder to plans with the store, each store apart, and needs a token', function () {
    $owner = designOwner();
    $category = asTenant($owner, fn () => Category::query()->create(['name' => 'سري', 'slug' => 'secret']));
    $this->getJson('/api/v1/dashboard/store/design')->assertOk();

    designOwner('basic');
    $this->getJson('/api/v1/dashboard/store/design')->assertForbidden()->assertJsonPath('feature', 'store');

    designOwner();
    $draft = designDraft();
    $draft['sections'][1]['props']['source'] = 'category';
    $draft['sections'][1]['props']['category_id'] = $category->id;
    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors(['draft.sections.1.props.category_id']);

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/store/design')->assertUnauthorized();
    $this->putJson('/api/v1/dashboard/store/design', [])->assertUnauthorized();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertUnauthorized();
});
