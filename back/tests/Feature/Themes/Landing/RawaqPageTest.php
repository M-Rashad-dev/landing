<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Order;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\ThemePurchase;
use App\Models\User;
use App\Services\FormToken;
use App\Support\OrderForm;
use App\Themes\Landing\RawaqLandingDesign;
use Laravel\Sanctum\Sanctum;

function rawaqLandingOwner(string $plan = 'pro', bool $owns = true): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create(['name' => 'رواق']);
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create();
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    if ($owns) {
        asTenant($tenant, fn () => ThemePurchase::query()->create(['theme_key' => 'rawaq_landing', 'source' => 'purchase', 'price_paid' => 150]));
    }
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function rawaqLandingPage(User $user): array
{
    $product = asTenant($user, fn () => Product::factory()->create(['name' => 'سيروم فيتامين C', 'price' => '450.00']));

    return test()->postJson('/api/v1/dashboard/pages', ['title' => 'سيروم', 'slug' => 'serum', 'theme_key' => 'rawaq_landing', 'product_id' => $product->id])
        ->assertCreated()->json('data');
}

function saveRawaqLanding(array $page, array $content, int $version = 1)
{
    return test()->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => $version, 'content' => $content]);
}

function rawaqLandingAt(array $content, string $type): int
{
    return (int) collect($content['sections'])->search(fn ($s) => $s['type'] === $type);
}

it('is a paid beauty landing theme at 150 EGP, bought apart from «رواق · متجر»', function () {
    $user = rawaqLandingOwner(owns: false);
    $theme = collect($this->getJson('/api/v1/dashboard/theme-store?kind=landing')->assertOk()->json('data'))->firstWhere('key', 'rawaq_landing');
    expect($theme)->toMatchArray(['name' => 'رواق', 'is_free' => false, 'owned' => false])
        ->and($theme['price']['final'])->toEqual(150);
    $this->getJson('/api/v1/dashboard/theme-store/rawaq_landing')->assertOk()->assertJsonCount(6, 'data.features');

    // Owning the store theme doesn't unlock the landing one.
    asTenant($user, fn () => ThemePurchase::query()->create(['theme_key' => 'rawaq_store', 'source' => 'purchase', 'price_paid' => 990]));
    $product = asTenant($user, fn () => Product::factory()->create());
    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'serum', 'theme_key' => 'rawaq_landing', 'product_id' => $product->id])
        ->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
});

it('starts a bought theme with its beauty sections, its colors and the product name', function () {
    $page = rawaqLandingPage(rawaqLandingOwner());
    $content = $page['draft_content'];

    expect($page['theme_key'])->toBe('rawaq_landing')
        ->and($content['settings']['colors'])->toBe(RawaqLandingDesign::DEFAULT_COLORS)
        ->and($content['sections'][0]['props']['title'])->toBe('سيروم فيتامين C')
        ->and(collect($content['sections'])->pluck('type')->all())->toContain('benefits', 'ingredients', 'how_to', 'suits')
        ->and(collect($content['sections'])->where('type', 'order_form'))->toHaveCount(1);
});

it('saves before/after, how to use and the other beauty sections, cleaned', function () {
    $user = rawaqLandingOwner();
    $page = rawaqLandingPage($user);
    [$before, $after] = asTenant($user, fn () => [Media::factory()->create(), Media::factory()->create()]);
    $content = $page['draft_content'];
    $hero = rawaqLandingAt($content, 'hero');
    $benefits = rawaqLandingAt($content, 'benefits');
    $content['settings']['colors']['dark'] = '#3A2030';
    $content['settings']['unknown'] = 'x';
    $content['sections'][$hero]['props']['title'] = '<b>سيروم</b> النضارة';
    $content['sections'][$hero]['props']['extra'] = 'x';
    $content['sections'][$benefits]['props']['items'][0]['color'] = '#F6E2DF';
    $content['sections'][] = ['id' => 'before000001', 'type' => 'before_after', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'الفرق', 'text' => null, 'before_media_id' => $before->id, 'after_media_id' => $after->id, 'before_label' => 'قبل', 'after_label' => 'بعد 4 أسابيع', 'facts' => [['value' => '92%', 'label' => 'أنعم']]]];
    $content['sections'][] = ['id' => 'stats0000001', 'type' => 'stats', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'items' => [['value' => '+2K', 'label' => 'عميلة'], ['value' => '4.9', 'label' => 'تقييم']]]];
    $content['sections'][] = ['id' => 'count0000001', 'type' => 'countdown', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'العرض بيخلص', 'text' => null, 'ends_at' => '2030-01-01T20:00:00+02:00', 'show_stock' => true]];

    $saved = saveRawaqLanding($page, $content)->assertOk()->json('data.draft_content');

    expect($saved['settings']['colors']['dark'])->toBe('#3a2030')
        ->and($saved['settings'])->not->toHaveKey('unknown')
        ->and($saved['sections'][$hero]['props']['title'])->toBe('سيروم النضارة')
        ->and($saved['sections'][$hero]['props'])->not->toHaveKey('extra')
        ->and($saved['sections'][$benefits]['props']['items'][0]['color'])->toBe('#f6e2df')
        ->and(collect($saved['sections'])->firstWhere('type', 'before_after')['props']['after_media_id'])->toBe($after->id)
        ->and(collect($saved['sections'])->firstWhere('type', 'countdown')['props']['ends_at'])->toBe('2030-01-01T18:00:00Z')
        ->and(collect($saved['sections'])->pluck('type')->take(-3)->values()->all())->toBe(['before_after', 'stats', 'countdown']);
});

it('reports wrong settings and sections by their path, and takes the store own images only', function () {
    $user = rawaqLandingOwner();
    $page = rawaqLandingPage($user);
    $foreign = asTenant(createOwner(), fn () => Media::factory()->create());
    $content = $page['draft_content'];
    $hero = rawaqLandingAt($content, 'hero');
    $howTo = rawaqLandingAt($content, 'how_to');
    $ingredients = rawaqLandingAt($content, 'ingredients');
    $trust = rawaqLandingAt($content, 'trust');

    $bad = $content;
    $bad['settings']['colors']['dark'] = 'black';
    $bad['sections'][$hero]['props']['chips'] = ['أ', 'ب', 'ج', 'د', 'ه'];
    $bad['sections'][$hero]['props']['image_media_id'] = $foreign->id;
    $bad['sections'][$howTo]['props']['steps'] = [['title' => 'خطوة', 'text' => null, 'time' => null]];
    $bad['sections'][$ingredients]['props']['items'][0]['symbol'] = 'VITC5';
    $bad['sections'][$trust]['props']['items'][0]['icon'] = 'rocket';
    $bad['sections'][] = ['id' => 'before000001', 'type' => 'before_after', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'text' => null, 'before_media_id' => null, 'after_media_id' => null, 'before_label' => 'قبل', 'after_label' => 'بعد', 'facts' => []]];
    $last = count($bad['sections']) - 1;

    saveRawaqLanding($page, $bad)->assertStatus(422)->assertJsonValidationErrors([
        'content.settings.colors.dark',
        "content.sections.{$hero}.props.chips",
        "content.sections.{$hero}.props.image_media_id",
        "content.sections.{$howTo}.props.steps",
        "content.sections.{$ingredients}.props.items.0.symbol",
        "content.sections.{$trust}.props.items.0.icon",
        "content.sections.{$last}.props.before_media_id",
        "content.sections.{$last}.props.after_media_id",
    ]);

    $hidden = $content;
    $hidden['sections'][rawaqLandingAt($content, 'order_form')]['visible'] = false;
    saveRawaqLanding($page, $hidden)->assertStatus(422)->assertJsonValidationErrors([sprintf('content.sections.%d.visible', rawaqLandingAt($content, 'order_form'))]);
});

it('publishes on a plan that allows paid themes and takes orders through its form', function () {
    $user = rawaqLandingOwner();
    $page = rawaqLandingPage($user);
    $host = asTenant($user, fn () => Domain::query()->value('host'));

    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();
    $data = $this->getJson("/api/v1/public/pages?host={$host}&slug=serum", internalHeaders())->assertOk()->json('data');
    expect($data['theme_key'])->toBe('rawaq_landing');

    $token = app(FormToken::class)->issue($page['id'], time() - 10);
    $number = $this->postJson('/api/v1/public/orders', [
        'host' => $host, 'slug' => 'serum', 'quantity' => 1, 'form_token' => $token, 'website' => '',
        'customer' => ['name' => 'سلمى أحمد', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'مدينة نصر'],
    ], internalHeaders())->assertCreated()->json('data.order_number');

    expect(asTenant($user, fn () => Order::query()->where('order_number', $number)->value('landing_page_id')))->toBe($page['id']);
});

it('stays owned but cannot publish on a plan without paid themes, and keeps another store pages out of reach', function () {
    $page = rawaqLandingPage(rawaqLandingOwner('basic'));
    $codes = collect($this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertStatus(422)->json('blockers'))->pluck('code');
    expect($codes)->toContain('theme_not_available');

    rawaqLandingOwner();
    $this->getJson("/api/v1/dashboard/pages/{$page['id']}")->assertNotFound();
    saveRawaqLanding($page, $page['draft_content'])->assertNotFound();
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson("/api/v1/dashboard/pages/{$page['id']}")->assertUnauthorized();
});

it('starts with defaults that pass its own validation in the shape the order form reads', function () {
    $defaults = RawaqLandingDesign::defaults('سيروم');
    $form = collect($defaults['sections'])->firstWhere('type', 'order_form')['props'];

    expect($defaults['sections'][0]['props']['title'])->toBe('سيروم')
        ->and(array_keys($form['fields']))->toBe(OrderForm::BUILT_IN)
        ->and(app(RawaqLandingDesign::class)->validate($defaults))->toBe($defaults);
});
