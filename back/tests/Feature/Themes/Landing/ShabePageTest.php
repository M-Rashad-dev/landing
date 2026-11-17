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
use App\Themes\Landing\ShabeLandingDesign;
use Laravel\Sanctum\Sanctum;

function shabeOwner(string $plan = 'pro', bool $owns = true): User
{
    $tenant = Tenant::factory()->onPlan($plan)->create(['name' => 'مطبخ شابع']);
    $user = User::factory()->for($tenant)->create();
    Domain::factory()->for($tenant)->create();
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    if ($owns) {
        asTenant($tenant, fn () => ThemePurchase::query()->create(['theme_key' => 'shabe', 'source' => 'purchase', 'price_paid' => 100]));
    }
    Sanctum::actingAs($user->fresh(['tenant']));

    return $user;
}

function shabePage(User $user): array
{
    $product = asTenant($user, fn () => Product::factory()->create(['name' => 'بوكس مشويات', 'price' => '899.00']));

    return test()->postJson('/api/v1/dashboard/pages', ['title' => 'بوكس العيلة', 'slug' => 'box', 'theme_key' => 'shabe', 'product_id' => $product->id])
        ->assertCreated()->json('data');
}

function saveShabe(array $page, array $content, int $version = 1)
{
    return test()->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => $version, 'content' => $content]);
}

/** Index of the first section of a type in a content. */
function shabeAt(array $content, string $type): int
{
    return (int) collect($content['sections'])->search(fn ($s) => $s['type'] === $type);
}

it('is a paid landing theme at 100 EGP the admin can change', function () {
    $this->getJson('/api/v1/dashboard/theme-store?kind=landing')->assertUnauthorized();
    shabeOwner(owns: false);

    $theme = collect($this->getJson('/api/v1/dashboard/theme-store?kind=landing')->assertOk()->json('data'))->firstWhere('key', 'shabe');
    expect($theme)->toMatchArray(['name' => 'شابع', 'is_free' => false, 'owned' => false])
        ->and($theme['price']['final'])->toEqual(100);
});

it('needs the theme bought before a page can use it', function () {
    $user = shabeOwner(owns: false);
    $product = asTenant($user, fn () => Product::factory()->create());

    $this->postJson('/api/v1/dashboard/pages', ['title' => 'x', 'slug' => 'box', 'theme_key' => 'shabe', 'product_id' => $product->id])
        ->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
});

it('starts a bought theme with its food sections and the product name', function () {
    $page = shabePage(shabeOwner());
    $content = $page['draft_content'];

    expect($page['theme_key'])->toBe('shabe')
        ->and($content['settings']['colors'])->toHaveKey('dark')
        ->and($content['sections'][0]['props']['title'])->toBe('بوكس مشويات')
        ->and(collect($content['sections'])->where('type', 'order_form'))->toHaveCount(1);
});

it('saves only what the theme knows and cleans the texts', function () {
    $page = shabePage(shabeOwner());
    $content = $page['draft_content'];
    $hero = shabeAt($content, 'hero');
    $content['settings']['colors']['dark'] = '#222222';
    $content['settings']['header']['countdown_ends_at'] = '2030-01-01T20:00:00+02:00';
    $content['settings']['unknown'] = 'x';
    $content['sections'][$hero]['props']['title'] = '<b>بوكس</b> العيلة';
    $content['sections'][$hero]['props']['extra'] = 'x';
    $content['sections'][] = ['id' => 'video000001', 'type' => 'video', 'visible' => true, 'props' => ['title' => 'شوف', 'subtitle' => null, 'url' => 'https://youtu.be/abc', 'cover_media_id' => null, 'caption' => null]];
    $content['sections'][] = ['id' => 'compare0001', 'type' => 'compare', 'visible' => true, 'props' => ['title' => null, 'us' => 'إحنا', 'them' => 'غيرنا', 'rows' => [['label' => 'السعر', 'us' => '180', 'them' => '290'], ['label' => 'طازة', 'us' => '✓', 'them' => '✗']]]];
    $content['sections'][] = ['id' => 'urgency0001', 'type' => 'urgency', 'visible' => true, 'props' => ['title' => 'العرض بيخلص', 'text' => null, 'ends_at' => null, 'show_stock' => true]];

    $saved = saveShabe($page, $content)->assertOk()->json('data.draft_content');

    expect($saved['settings']['colors']['dark'])->toBe('#222222')
        ->and($saved['settings']['header']['countdown_ends_at'])->toBe('2030-01-01T18:00:00Z')
        ->and($saved['settings'])->not->toHaveKey('unknown')
        ->and($saved['sections'][$hero]['props']['title'])->toBe('بوكس العيلة')
        ->and($saved['sections'][$hero]['props'])->not->toHaveKey('extra')
        ->and(collect($saved['sections'])->pluck('type')->take(-3)->values()->all())->toBe(['video', 'compare', 'urgency']);
});

it('reports wrong sections by their path', function () {
    $page = shabePage(shabeOwner());
    $content = $page['draft_content'];
    $hero = shabeAt($content, 'hero');
    $menu = shabeAt($content, 'menu');

    $bad = $content;
    $bad['settings']['colors']['dark'] = 'black';
    $bad['sections'][$hero]['props']['stickers'] = ['أ', 'ب', 'ج'];
    $bad['sections'][$hero]['props']['trust'][0]['icon'] = 'rocket';
    $bad['sections'][$menu]['props']['items'] = [];
    $bad['sections'][] = ['id' => 'video000001', 'type' => 'video', 'visible' => true, 'props' => ['title' => null, 'subtitle' => null, 'url' => 'https://example.com/v.mp4', 'cover_media_id' => null, 'caption' => null]];
    $video = count($bad['sections']) - 1;

    saveShabe($page, $bad)->assertStatus(422)->assertJsonValidationErrors([
        'content.settings.colors.dark',
        "content.sections.{$hero}.props.stickers",
        "content.sections.{$hero}.props.trust.0.icon",
        "content.sections.{$menu}.props.items",
        "content.sections.{$video}.props.url",
    ]);

    $twoForms = $content;
    $twoForms['sections'][] = array_merge($content['sections'][shabeAt($content, 'order_form')], ['id' => 'second-form']);
    saveShabe($page, $twoForms)->assertStatus(422)->assertJsonValidationErrors(['content.sections']);
});

it('ties pack cards to the store own offers and images only', function () {
    $user = shabeOwner();
    $page = shabePage($user);
    $mine = asTenant($user, fn () => Offer::factory()->create());
    $foreign = asTenant(createOwner(), fn () => Offer::factory()->create());
    $foreignImage = asTenant(createOwner(), fn () => Media::factory()->create());
    $content = $page['draft_content'];
    $i = shabeAt($content, 'bundles');
    $card = ['offer_id' => $mine->id, 'image_media_id' => null, 'title' => 'بوكس العيلة', 'subtitle' => 'لـ ٤ أفراد', 'points' => ['٢ كيلو مشويات'], 'ribbon' => 'الأكتر طلبًا'];

    $content['sections'][$i]['props']['cards'] = [$card, ['offer_id' => null] + $card];
    saveShabe($page, $content)->assertOk()->assertJsonPath("data.draft_content.sections.{$i}.props.cards.0.offer_id", $mine->id);

    $content['sections'][$i]['props']['cards'] = [['offer_id' => $foreign->id, 'image_media_id' => $foreignImage->id] + $card];
    saveShabe($page, $content, 2)->assertStatus(422)->assertJsonValidationErrors(["content.sections.{$i}.props.cards.0.offer_id", "content.sections.{$i}.props.cards.0.image_media_id"]);
});

it('publishes on a plan that allows paid themes and takes orders through its form', function () {
    $user = shabeOwner();
    $page = shabePage($user);
    $host = asTenant($user, fn () => Domain::query()->value('host'));

    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();
    $data = $this->getJson("/api/v1/public/pages?host={$host}&slug=box", internalHeaders())->assertOk()->json('data');
    expect($data['theme_key'])->toBe('shabe')->and($data['store_name'])->toBe('مطبخ شابع');

    $token = app(FormToken::class)->issue($page['id'], time() - 10);
    $number = $this->postJson('/api/v1/public/orders', [
        'host' => $host, 'slug' => 'box', 'quantity' => 1, 'form_token' => $token, 'website' => '',
        'customer' => ['name' => 'منى إبراهيم', 'phone' => '01012345678', 'governorate' => 'القاهرة', 'address' => 'مدينة نصر'],
    ], internalHeaders())->assertCreated()->json('data.order_number');

    expect(asTenant($user, fn () => Order::query()->where('order_number', $number)->value('landing_page_id')))->toBe($page['id']);
});

it('stays owned but cannot publish on a plan without paid themes', function () {
    $user = shabeOwner('basic');
    $page = shabePage($user);

    $codes = collect($this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertStatus(422)->json('blockers'))->pluck('code');
    expect($codes)->toContain('theme_not_available');
});

it('keeps another store pages out of reach', function () {
    $page = shabePage(shabeOwner());
    shabeOwner();

    $this->getJson("/api/v1/dashboard/pages/{$page['id']}")->assertNotFound();
    saveShabe($page, $page['draft_content'])->assertNotFound();
});

it('starts with defaults that pass its own validation in the shape the order form reads', function () {
    $defaults = ShabeLandingDesign::defaults('بوكس');
    $form = collect($defaults['sections'])->firstWhere('type', 'order_form')['props'];

    expect($defaults['sections'][0]['props']['title'])->toBe('بوكس')
        ->and(array_keys($form['fields']))->toBe(OrderForm::BUILT_IN)
        ->and(app(ShabeLandingDesign::class)->validate($defaults))->toBe($defaults);
});
