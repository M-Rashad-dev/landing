<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\ThemePurchase;
use App\Models\User;
use App\Services\FormToken;
use App\Support\OrderForm;
use App\Themes\Landing\LandingThemeDesign;
use App\Themes\Landing\LandingThemes;
use App\Themes\Landing\SufiLandingDesign;
use Laravel\Sanctum\Sanctum;

function sufiLandingOwner(string $plan = 'pro', bool $owns = true): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create(['name' => 'دار العطور']);
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create();
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    if ($owns) {
        asTenant($tenant, fn () => ThemePurchase::query()->create(['theme_key' => 'sufi_landing', 'source' => 'purchase', 'price_paid' => 150]));
    }
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function sufiLandingPage(User $user): array
{
    $product = asTenant($user, fn () => Product::factory()->create(['name' => 'عطر عود ملكي', 'price' => '1450.00']));

    return test()->postJson('/api/v1/dashboard/pages', ['title' => 'عود ملكي', 'slug' => 'oud', 'theme_key' => 'sufi_landing', 'product_id' => $product->id])
        ->assertCreated()->json('data');
}

function saveSufiLanding(array $page, array $content, int $version = 1)
{
    return test()->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => $version, 'content' => $content]);
}

function sufiLandingAt(array $content, string $type): int
{
    return (int) collect($content['sections'])->search(fn ($s) => $s['type'] === $type);
}

it('is a paid landing theme at 150 EGP the admin can change', function () {
    $this->getJson('/api/v1/dashboard/theme-store?kind=landing')->assertUnauthorized();
    sufiLandingOwner(owns: false);

    $theme = collect($this->getJson('/api/v1/dashboard/theme-store?kind=landing')->assertOk()->json('data'))->firstWhere('key', 'sufi_landing');
    expect($theme)->toMatchArray(['name' => 'صوفي', 'is_free' => false, 'owned' => false])
        ->and($theme['price']['final'])->toEqual(150);
    $this->getJson('/api/v1/dashboard/theme-store/sufi_landing')->assertOk()->assertJsonCount(6, 'data.features');
});

it('needs the theme bought before a page can use it (owning «صوفي · متجر» is not enough)', function () {
    $user = sufiLandingOwner(owns: false);
    asTenant($user, fn () => ThemePurchase::query()->create(['theme_key' => 'sufi_store', 'source' => 'purchase', 'price_paid' => 990]));
    $product = asTenant($user, fn () => Product::factory()->create());

    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'oud', 'theme_key' => 'sufi_landing', 'product_id' => $product->id])
        ->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
});

it('starts a bought theme with its sections, both color schemes and the product name', function () {
    $page = sufiLandingPage(sufiLandingOwner());
    $content = $page['draft_content'];

    expect($page['theme_key'])->toBe('sufi_landing')
        ->and($content['settings']['colors_dark'])->toBe(SufiLandingDesign::DARK_COLORS)
        ->and($content['settings']['appearance'])->toBe(['default' => 'light', 'toggle' => true])
        ->and($content['sections'][0]['props']['title'])->toBe('عطر عود ملكي')
        ->and(collect($content['sections'])->pluck('type')->all())->toContain('details', 'specs', 'promises')
        ->and(collect($content['sections'])->where('type', 'order_form'))->toHaveCount(1);
});

it('saves only what the theme knows and cleans the texts', function () {
    $page = sufiLandingPage(sufiLandingOwner());
    $content = $page['draft_content'];
    $hero = sufiLandingAt($content, 'hero');
    $content['settings']['colors_dark']['primary'] = '#E0B070';
    $content['settings']['appearance'] = ['default' => 'system', 'toggle' => false];
    $content['settings']['general']['animations'] = false;
    $content['settings']['unknown'] = 'x';
    $content['sections'][$hero]['props']['layout'] = 'cover';
    $content['sections'][$hero]['props']['title'] = '<b>عود</b> ملكي';
    $content['sections'][$hero]['props']['extra'] = 'x';
    $content['sections'][] = ['id' => 'stats000001', 'type' => 'stats', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'items' => [['value' => '+12 ألف', 'label' => 'عميل'], ['value' => '4.9', 'label' => 'تقييم']]]];
    $content['sections'][] = ['id' => 'count000001', 'type' => 'countdown', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'العرض بيخلص', 'text' => null, 'ends_at' => '2030-01-01T20:00:00+02:00', 'show_stock' => true]];
    $content['sections'][] = ['id' => 'video000001', 'type' => 'video', 'visible' => true, 'props' => ['title' => 'شوف', 'subtitle' => null, 'url' => 'https://youtu.be/abc', 'cover_media_id' => null]];

    $saved = saveSufiLanding($page, $content)->assertOk()->json('data.draft_content');

    expect($saved['settings']['colors_dark']['primary'])->toBe('#e0b070')
        ->and($saved['settings']['appearance'])->toBe(['default' => 'system', 'toggle' => false])
        ->and($saved['settings']['general']['animations'])->toBeFalse()
        ->and($saved['settings'])->not->toHaveKey('unknown')
        ->and($saved['sections'][$hero]['props']['layout'])->toBe('cover')
        ->and($saved['sections'][$hero]['props']['title'])->toBe('عود ملكي')
        ->and($saved['sections'][$hero]['props'])->not->toHaveKey('extra')
        ->and(collect($saved['sections'])->firstWhere('type', 'countdown')['props']['ends_at'])->toBe('2030-01-01T18:00:00Z')
        ->and(collect($saved['sections'])->pluck('type')->take(-3)->values()->all())->toBe(['stats', 'countdown', 'video']);
});

it('reports wrong settings and sections by their path', function () {
    $page = sufiLandingPage(sufiLandingOwner());
    $content = $page['draft_content'];
    $hero = sufiLandingAt($content, 'hero');
    $specs = sufiLandingAt($content, 'specs');
    $features = sufiLandingAt($content, 'features');

    $bad = $content;
    $bad['settings']['colors_dark']['background'] = 'black';
    $bad['settings']['appearance']['default'] = 'sepia';
    $bad['sections'][$hero]['props']['layout'] = 'carousel';
    $bad['sections'][$hero]['props']['badges'] = ['أ', 'ب', 'ج', 'د'];
    $bad['sections'][$specs]['props']['rows'] = [['label' => 'الخامة', 'value' => 'جلد']];
    $bad['sections'][$features]['props']['items'][0]['icon'] = 'rocket';

    saveSufiLanding($page, $bad)->assertStatus(422)->assertJsonValidationErrors([
        'content.settings.colors_dark.background',
        'content.settings.appearance.default',
        "content.sections.{$hero}.props.layout",
        "content.sections.{$hero}.props.badges",
        "content.sections.{$specs}.props.rows",
        "content.sections.{$features}.props.items.0.icon",
    ]);

    $hidden = $content;
    $hidden['sections'][sufiLandingAt($content, 'order_form')]['visible'] = false;
    saveSufiLanding($page, $hidden)->assertStatus(422)->assertJsonValidationErrors([sprintf('content.sections.%d.visible', sufiLandingAt($content, 'order_form'))]);
});

it('takes the store own offers and images only', function () {
    $user = sufiLandingOwner();
    $page = sufiLandingPage($user);
    $mine = asTenant($user, fn () => Offer::factory()->create());
    $image = asTenant($user, fn () => Media::factory()->create());
    $foreign = asTenant(createOwner(), fn () => Offer::factory()->create());
    $foreignImage = asTenant(createOwner(), fn () => Media::factory()->create());
    $content = $page['draft_content'];
    $bundles = sufiLandingAt($content, 'bundles');
    $details = sufiLandingAt($content, 'details');
    $card = ['offer_id' => $mine->id, 'image_media_id' => $image->id, 'title' => 'زجاجتين', 'subtitle' => null, 'points' => ['تغليف هدية'], 'ribbon' => 'الأوفر'];

    $content['sections'][$bundles]['props']['cards'] = [$card];
    $content['sections'][$details]['props']['rows'][0]['image_media_id'] = $image->id;
    saveSufiLanding($page, $content)->assertOk()
        ->assertJsonPath("data.draft_content.sections.{$bundles}.props.cards.0.offer_id", $mine->id)
        ->assertJsonPath("data.draft_content.sections.{$details}.props.rows.0.image_media_id", $image->id);

    $content['sections'][$bundles]['props']['cards'] = [['offer_id' => $foreign->id] + $card];
    $content['sections'][$details]['props']['rows'][0]['image_media_id'] = $foreignImage->id;
    saveSufiLanding($page, $content, 2)->assertStatus(422)->assertJsonValidationErrors([
        "content.sections.{$bundles}.props.cards.0.offer_id",
        "content.sections.{$details}.props.rows.0.image_media_id",
    ]);
});

it('publishes on a plan that allows paid themes and takes orders through its form', function () {
    $user = sufiLandingOwner();
    $page = sufiLandingPage($user);
    $host = asTenant($user, fn () => Domain::query()->value('host'));

    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();
    $data = $this->getJson("/api/v1/public/pages?host={$host}&slug=oud", internalHeaders())->assertOk()->json('data');
    expect($data['theme_key'])->toBe('sufi_landing')
        ->and($data['content']['settings']['colors_dark'])->toBe(SufiLandingDesign::DARK_COLORS);

    $token = app(FormToken::class)->issue($page['id'], time() - 10);
    $number = $this->postJson('/api/v1/public/orders', [
        'host' => $host, 'slug' => 'oud', 'quantity' => 1, 'form_token' => $token, 'website' => '',
        'customer' => ['name' => 'منى إبراهيم', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'مدينة نصر'],
    ], internalHeaders())->assertCreated()->json('data.order_number');

    expect(asTenant($user, fn () => Order::query()->where('order_number', $number)->value('landing_page_id')))->toBe($page['id']);
});

it('stays owned but cannot publish on a plan without paid themes', function () {
    $page = sufiLandingPage(sufiLandingOwner('basic'));

    $codes = collect($this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertStatus(422)->json('blockers'))->pluck('code');
    expect($codes)->toContain('theme_not_available');
});

it('keeps another store pages out of reach', function () {
    $page = sufiLandingPage(sufiLandingOwner());
    sufiLandingOwner();

    $this->getJson("/api/v1/dashboard/pages/{$page['id']}")->assertNotFound();
    saveSufiLanding($page, $page['draft_content'])->assertNotFound();
});

it('starts with defaults that pass its own validation in the shape the order form reads', function () {
    $defaults = SufiLandingDesign::defaults('عود');
    $form = collect($defaults['sections'])->firstWhere('type', 'order_form')['props'];

    expect($defaults['sections'][0]['props']['title'])->toBe('عود')
        ->and(array_keys($form['fields']))->toBe(OrderForm::BUILT_IN)
        ->and(app(SufiLandingDesign::class)->validate($defaults))->toBe($defaults);
});

it('keeps every registered landing theme to the contract', function () {
    $themes = app(LandingThemes::class);
    expect(LandingThemes::keys())->toBe(['bidaya_landing', 'shabe_landing', 'sufi_landing']);

    foreach (LandingThemes::THEMES as $class) {
        $design = $themes->for($class::KEY);
        $defaults = $class::defaults('منتج');
        $types = collect($defaults['sections'])->pluck('type');

        expect($design)->toBeInstanceOf(LandingThemeDesign::class)
            ->and($class::KEY)->toEndWith('_landing')
            ->and($types->filter(fn ($t) => $t === 'order_form'))->toHaveCount(1)
            ->and($types->diff($class::SECTION_TYPES)->all())->toBe([])
            ->and($design->validate($defaults))->toBe($defaults);
    }
    expect($themes->for('nope'))->toBeNull();
});
