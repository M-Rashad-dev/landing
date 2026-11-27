<?php

declare(strict_types=1);

use App\Billing\Themes\ThemeAccess;
use App\Models\Category;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Themes\Store\RawaqStoreDesign;
use Laravel\Sanctum\Sanctum;

// Same helpers as StoreDesignTest (defined once, whichever file loads first).
if (! function_exists('designOwner')) {
    function designOwner(string $plan = 'pro'): User
    {
        $tenant = Tenant::factory()->onPlan($plan)->create();
        $user = User::factory()->for($tenant)->create();
        Domain::factory()->for($tenant)->create(['host' => 'design-'.$tenant->id.'.localhost', 'active_host' => 'design-'.$tenant->id.'.localhost']);
        asTenant($tenant, fn () => Identity::factory()->default()->create());
        Sanctum::actingAs($user->fresh(['tenant']));

        return $user;
    }

    function designDraft(array $changes = []): array
    {
        return array_replace_recursive(test()->getJson('/api/v1/dashboard/store/design')->assertOk()->json('data.draft'), $changes);
    }

    function saveDesign(array $draft, ?int $version = null)
    {
        $version ??= test()->getJson('/api/v1/dashboard/store/design')->json('data.version');

        return test()->putJson('/api/v1/dashboard/store/design', ['draft' => $draft, 'version' => $version]);
    }
}

/** A store owner on «رواق» (bought), in the Builder. */
function rawaqOwner(): User
{
    $owner = designOwner();
    app(ThemeAccess::class)->grant($owner->tenant, RawaqStoreDesign::KEY, 'purchase', null, 99000);
    test()->getJson('/api/v1/dashboard/store/design')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['theme_key' => RawaqStoreDesign::KEY])->assertOk();

    return $owner;
}

const RAWAQ_NONE = ['type' => 'none', 'target_id' => null, 'url' => null];

it('switches a store that bought «رواق» to its beauty starter design, its section types and its settings', function () {
    rawaqOwner();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk()
        ->assertJsonPath('data.theme.key', 'rawaq_store')
        ->assertJsonPath('data.theme.section_types', RawaqStoreDesign::SECTION_TYPES)
        ->assertJsonPath('data.theme.settings_groups', ['look', 'header', 'footer', 'general', 'product_card'])
        ->assertJsonPath('data.draft.settings.colors.primary', '#b9507a')
        ->assertJsonPath('data.draft.settings.colors.dark', '#2b2226')
        ->assertJsonPath('data.draft.settings.product_card.tinted', true)
        ->assertJsonPath('data.draft.settings.footer.payments', true);
    expect(array_column($res->json('data.draft.sections'), 'type'))->toBe(['glow_hero', 'features', 'shortcuts', 'shortcuts', 'product_tabs', 'ingredients', 'testimonials', 'cta'])
        ->and($res->json('data.data.links'))->toHaveKey($res->json('data.draft.sections.0.id').':primary');

    // The starter design saves as it is.
    saveDesign(designDraft())->assertOk();
});

it('refuses «رواق» to a store that did not buy it', function () {
    designOwner();
    $this->getJson('/api/v1/dashboard/store/design')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['theme_key' => RawaqStoreDesign::KEY])->assertStatus(422);
});

it('saves its own sections and sends their links, the routine\'s products in order, and the reels\' covers', function () {
    $owner = rawaqOwner();
    [$category, $serum, $cream] = asTenant($owner, fn () => [
        Category::query()->create(['name' => 'بشرة دهنية', 'slug' => 'oily', 'depth' => 0, 'position' => 0, 'is_visible' => true]),
        Product::factory()->create(['name' => 'سيروم', 'in_store' => true]),
        Product::factory()->create(['name' => 'كريم', 'in_store' => true]),
    ]);
    $draft = designDraft();
    $draft['sections'] = [
        ['id' => 'shortcuts01', 'type' => 'shortcuts', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'حسب بشرتك', 'description' => null, 'style' => 'circles', 'items' => [
            ['label' => 'دهنية', 'text' => '<b>48</b> منتج', 'media_id' => null, 'color' => '#F6E2DF', 'link' => ['type' => 'category', 'target_id' => $category->id, 'url' => null]],
            ['label' => 'حب الشباب', 'text' => null, 'media_id' => null, 'color' => null, 'link' => ['type' => 'product', 'target_id' => $serum->id, 'url' => null]],
            ['label' => 'المدونة', 'text' => null, 'media_id' => null, 'color' => null, 'link' => ['type' => 'url', 'target_id' => null, 'url' => 'https://example.com/tips']],
        ]]],
        ['id' => 'routine0001', 'type' => 'routine', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'روتين البشرة الدهنية', 'text' => null, 'button_label' => null, 'steps' => [
            ['product_id' => $cream->id, 'label' => 'مرطّب', 'hint' => null],
            ['product_id' => $serum->id, 'label' => 'سيروم', 'hint' => '3 نقط'],
        ]]],
        ['id' => 'reels000001', 'type' => 'reels', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'إزاي تستخدميه', 'items' => [['url' => 'https://www.youtube.com/shorts/abc123', 'title' => 'روتين الصبح', 'cover_media_id' => null]]]],
        ['id' => 'ingred00001', 'type' => 'ingredients', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'المكوّنات', 'description' => null, 'items' => [
            ['symbol' => 'C', 'name' => 'فيتامين C', 'text' => null, 'color' => null, 'link' => RAWAQ_NONE],
            ['symbol' => 'B3', 'name' => 'نياسيناميد', 'text' => null, 'color' => null, 'link' => ['type' => 'offers', 'target_id' => null, 'url' => null]],
        ]]],
        ['id' => 'cta00000001', 'type' => 'cta', 'visible' => true, 'props' => ['title' => 'العروض', 'text' => null, 'button_label' => 'اشتركي', 'action' => 'link', 'message' => null, 'link' => ['type' => 'offers', 'target_id' => null, 'url' => null]]],
    ];
    saveDesign($draft)->assertOk();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk();
    expect($res->json('data.draft.sections.0.props.items.0.text'))->toBe('48 منتج')
        ->and($res->json('data.draft.sections.0.props.items.0.color'))->toBe('#f6e2df')
        ->and($res->json('data.data.links')['shortcuts01:0'])->toBe('/categories/oily')
        ->and($res->json('data.data.links')['shortcuts01:2'])->toBe('https://example.com/tips')
        ->and($res->json('data.data.links')['ingred00001:1'])->toBe('/offers')
        ->and($res->json('data.data.links')['cta00000001'])->toBe('/offers')
        ->and(array_column($res->json('data.data.products')['routine0001'], 'name'))->toBe(['كريم', 'سيروم']);
});

it('checks its sections and settings', function () {
    $owner = rawaqOwner();
    $serum = asTenant($owner, fn () => Product::factory()->create(['in_store' => true]));
    $foreign = asTenant(Tenant::factory()->create(), fn () => Product::factory()->create());
    $draft = designDraft();
    $draft['settings']['product_card']['image'] = 'round';
    $draft['settings']['colors']['dark'] = 'black';
    $draft['sections'] = [
        ['id' => 'shortcuts01', 'type' => 'shortcuts', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'description' => null, 'style' => 'zigzag', 'items' => [
            ['label' => '', 'text' => null, 'media_id' => null, 'color' => 'pink', 'link' => ['type' => 'url', 'target_id' => null, 'url' => 'javascript:alert(1)']],
        ]]],
        ['id' => 'routine0001', 'type' => 'routine', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'روتين', 'text' => null, 'button_label' => null, 'steps' => [
            ['product_id' => $serum->id, 'label' => null, 'hint' => null],
            ['product_id' => $foreign->id, 'label' => null, 'hint' => null],
        ]]],
        ['id' => 'reels000001', 'type' => 'reels', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'items' => [['url' => 'https://evil.example.com/v.mp4', 'title' => null, 'cover_media_id' => null]]]],
        ['id' => 'cta00000001', 'type' => 'cta', 'visible' => true, 'props' => ['title' => '', 'text' => null, 'button_label' => 'x', 'action' => 'email', 'message' => null, 'link' => RAWAQ_NONE]],
        // Another theme's section is not «رواق»'s.
        ['id' => 'hours000001', 'type' => 'hours', 'visible' => true, 'props' => []],
    ];

    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors([
        'draft.settings.product_card.image', 'draft.settings.colors.dark',
        'draft.sections.0.props.style', 'draft.sections.0.props.items', 'draft.sections.0.props.items.0.label', 'draft.sections.0.props.items.0.color', 'draft.sections.0.props.items.0.link.url',
        'draft.sections.1.props.steps.1.product_id',
        'draft.sections.2.props.items.0.url',
        'draft.sections.3.props.title', 'draft.sections.3.props.action',
        'draft.sections.4.type',
    ]);
});
