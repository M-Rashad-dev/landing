<?php

declare(strict_types=1);

use App\Actions\Promotions\SaveOffer;
use App\Billing\Themes\ThemeAccess;
use App\Enums\OfferType;
use App\Models\Category;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Themes\Store\ShabeStoreDesign;
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

/** A store owner on «شابع · متجر» (bought), in the Builder. */
function shabeStoreOwner(): User
{
    $owner = designOwner();
    app(ThemeAccess::class)->grant($owner->tenant, ShabeStoreDesign::KEY, 'purchase', null, 99000);
    test()->getJson('/api/v1/dashboard/store/design')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['theme_key' => ShabeStoreDesign::KEY])->assertOk();

    return $owner;
}

const SHABE_LINK_NONE = ['type' => 'none', 'target_id' => null, 'url' => null];

function shabeHours(): array
{
    return array_fill(0, 7, ['open' => true, 'from' => '12:00', 'to' => '23:00']);
}

it('switches a store that bought «شابع» to its food starter design, its 15 section types and its settings', function () {
    shabeStoreOwner();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk()
        ->assertJsonPath('data.theme.key', 'shabe_store')
        ->assertJsonPath('data.theme.section_types', ShabeStoreDesign::SECTION_TYPES)
        ->assertJsonPath('data.theme.max_sections', 30)
        ->assertJsonPath('data.draft.settings.colors.primary', '#e4572e')
        ->assertJsonPath('data.draft.settings.colors.dark', '#17110d')
        ->assertJsonPath('data.draft.settings.button', 'pill')
        ->assertJsonPath('data.draft.settings.header.categories_menu', true)
        ->assertJsonPath('data.draft.settings.footer.dark', true);
    expect(array_column($res->json('data.draft.sections'), 'type'))->toBe(['food_hero', 'marquee', 'categories', 'product_tabs', 'why', 'steps', 'testimonials', 'hours', 'faq'])
        ->and($res->json('data.data.links.header_button'))->toBe('/products');

    saveDesign(designDraft())->assertOk();
    // A short hotline (19xxx) is a real number.
    saveDesign(designDraft(['settings' => ['header' => ['hotline' => '19999']]]))->assertOk()->assertJsonPath('data.draft.settings.header.hotline', '19999');
});

it('refuses «شابع · متجر» to a store that did not buy it (the landing «شابع» is another theme)', function () {
    $owner = designOwner();
    app(ThemeAccess::class)->grant($owner->tenant, 'shabe_landing', 'purchase', null, 10000);
    $this->getJson('/api/v1/dashboard/store/design')->assertOk();

    $this->putJson('/api/v1/dashboard/store', ['theme_key' => ShabeStoreDesign::KEY])->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
});

it('saves the food sections and gives the hero links and each pack card its offer', function () {
    $owner = shabeStoreOwner();
    [$image, $box, $deal, $site] = asTenant($owner, function () {
        $image = Media::factory()->create();
        $box = Product::factory()->create(['name' => 'بوكس العيلة', 'slug' => 'family-box', 'price' => '899.00']);
        $deal = app(SaveOffer::class)->handle(['name' => 'بوكسين للعزومة', 'type' => OfferType::Bundle, 'value' => null, 'bundle_quantity' => 2, 'bundle_price' => '1650.00', 'is_active' => true, 'badge_text' => null, 'priority' => 1], [$box->id], []);
        $site = app(SaveOffer::class)->handle(['name' => 'خصم الموقع', 'type' => OfferType::Percentage, 'value' => '10', 'is_active' => true, 'badge_text' => null, 'priority' => 0], [], []);

        return [$image, $box, $deal, $site];
    });
    $toBox = ['type' => 'product', 'target_id' => $box->id, 'url' => null];
    $sections = [
        ['id' => 'hero00000001', 'type' => 'food_hero', 'visible' => true, 'props' => ['kicker' => 'طازة', 'title' => 'بوكس <b>شابع</b>', 'highlight' => 'شابع', 'subtitle' => null, 'media_id' => $image->id, 'stickers' => ['سخن'], 'badge' => '-20%', 'primary_label' => 'اطلب', 'primary_link' => $toBox, 'second_label' => 'المنيو', 'second_link' => ['type' => 'all_products', 'target_id' => null, 'url' => null], 'trust' => [['icon' => 'bike', 'text' => 'توصيل سريع']]]],
        ['id' => 'pack00000001', 'type' => 'bundles', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'الباقات', 'subtitle' => null, 'cards' => [
            ['offer_id' => $deal->id, 'media_id' => $image->id, 'title' => 'بوكس العزومة', 'subtitle' => 'لـ ٨ أفراد', 'points' => ['٤ كيلو مشويات'], 'ribbon' => 'الأكتر طلبًا', 'button_label' => 'اختار ده'],
            ['offer_id' => $site->id, 'media_id' => null, 'title' => 'خصم على كله', 'subtitle' => null, 'points' => [], 'ribbon' => null, 'button_label' => null],
        ]]],
        ['id' => 'why000000001', 'type' => 'why', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'ليه إحنا', 'subtitle' => null, 'media_id' => null, 'quote' => 'بنشوي ساعة الطلب', 'items' => [['icon' => 'chef', 'title' => 'شيف', 'text' => null], ['icon' => 'leaf', 'title' => 'طازة', 'text' => null]]]],
        ['id' => 'step00000001', 'type' => 'steps', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'الخطوات', 'items' => [['icon' => 'utensils', 'title' => 'اختار', 'text' => null], ['icon' => 'bike', 'title' => 'استلم', 'text' => null]]]],
        ['id' => 'hour00000001', 'type' => 'hours', 'visible' => true, 'props' => ['title' => 'المواعيد', 'subtitle' => null, 'days' => [...array_fill(0, 6, ['open' => true, 'from' => '18:00', 'to' => '02:00']), ['open' => false, 'from' => '12:00', 'to' => '23:00']], 'open_message' => 'شغالين', 'closed_message' => 'مقفولين']],
    ];

    $res = saveDesign(designDraft() + [])->assertOk();
    $draft = $res->json('data.draft');
    $draft['sections'] = $sections;
    $saved = saveDesign($draft)->assertOk();

    expect($saved->json('data.draft.sections.0.props.title'))->toBe('بوكس شابع')
        ->and($saved->json('data.data.links')['hero00000001:primary'])->toBe('/products/'.rawurlencode($box->slug))
        ->and($saved->json('data.data.links')['hero00000001:second'])->toBe('/products')
        ->and($saved->json('data.data.media'))->toHaveKey((string) $image->id)
        ->and($saved->json('data.draft.sections.4.props.days.0'))->toBe(['open' => true, 'from' => '18:00', 'to' => '02:00']);
    $cards = $saved->json('data.data.bundles.pack00000001');
    expect($cards[0]['offer']['bundle_price'])->toEqual(1650)
        ->and($cards[0]['product']['id'])->toBe($box->id)
        ->and($cards[0]['href'])->toBe('/products/'.rawurlencode($box->slug))
        ->and($cards[1]['product'])->toBeNull()
        ->and($cards[1]['href'])->toBe('/offers');

    // A stopped offer: its card shows nothing to buy.
    asTenant($owner, fn () => $deal->update(['is_active' => false]));
    expect($this->getJson('/api/v1/dashboard/store/design')->json('data.data.bundles.pack00000001.0'))->toBeNull();
});

it('checks the food sections and settings', function () {
    $owner = shabeStoreOwner();
    $foreignOffer = asTenant(Tenant::factory()->create(), fn () => Offer::query()->create(['name' => 'x', 'type' => OfferType::Percentage, 'applies_to' => 'all', 'value' => '5', 'is_active' => true, 'priority' => 0]));
    $draft = designDraft([
        'settings' => ['button' => 'blob', 'header' => ['hotline' => 'call me', 'layout' => 'end'], 'colors' => ['dark' => 'black']],
    ]);
    $draft['sections'] = [
        ['id' => 'hour00000001', 'type' => 'hours', 'visible' => true, 'props' => ['title' => null, 'subtitle' => null, 'days' => [['open' => true, 'from' => '25:00', 'to' => '9pm']], 'open_message' => '', 'closed_message' => 'مقفولين']],
        ['id' => 'pack00000001', 'type' => 'bundles', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'subtitle' => null, 'cards' => [['offer_id' => $foreignOffer->id, 'media_id' => null, 'title' => 'x', 'subtitle' => null, 'points' => [], 'ribbon' => null, 'button_label' => null]]]],
        ['id' => 'hero00000001', 'type' => 'food_hero', 'visible' => true, 'props' => ['kicker' => null, 'title' => '', 'highlight' => null, 'subtitle' => null, 'media_id' => null, 'stickers' => ['a', 'b', 'c'], 'badge' => null, 'primary_label' => 'اطلب', 'primary_link' => SHABE_LINK_NONE, 'second_label' => null, 'second_link' => SHABE_LINK_NONE, 'trust' => [['icon' => 'rocket', 'text' => 'x']]]],
        ['id' => 'sufi00000001', 'type' => 'brands', 'visible' => true, 'props' => ['title' => null, 'items' => []]],
    ];

    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors([
        'draft.settings.button', 'draft.settings.header.hotline', 'draft.settings.header.layout', 'draft.settings.colors.dark',
        'draft.sections.0.props.days', 'draft.sections.0.props.days.0.from', 'draft.sections.0.props.days.0.to', 'draft.sections.0.props.open_message',
        'draft.sections.1.props.cards.0.offer_id',
        'draft.sections.2.props.title', 'draft.sections.2.props.stickers', 'draft.sections.2.props.trust.0.icon',
        // «صوفي»'s brands is not one of «شابع»'s sections.
        'draft.sections.3.type',
    ]);
    unset($owner);
});

it('saves the product card and product page settings, and gives old designs their defaults', function () {
    shabeStoreOwner();
    $card = ['image' => 'circle', 'show_description' => false, 'show_rating' => true, 'button' => 'full', 'border_width' => 0, 'border_color' => '#E4572E', 'radius' => 12, 'shadow' => true];
    $page = ['gallery' => 'slider', 'zoom' => false, 'description' => true, 'reviews' => false, 'whatsapp_ask' => false, 'related_enabled' => true, 'related' => 'similar', 'sticky_bar' => true, 'sticky_buttons' => 'cart', 'viewers' => ['enabled' => true, 'min' => 1, 'max' => 999000, 'every' => 10]];

    $saved = saveDesign(designDraft(['settings' => ['product_card' => $card, 'product_page' => $page]]))->assertOk();
    expect($saved->json('data.draft.settings.product_card'))->toBe(array_replace($card, ['border_color' => '#e4572e']))
        ->and($saved->json('data.draft.settings.product_page'))->toBe($page);

    // A design saved before these groups existed: still valid, with the defaults.
    $old = designDraft();
    unset($old['settings']['product_card'], $old['settings']['product_page']);
    expect(saveDesign($old)->assertOk()->json('data.draft.settings.product_page.sticky_buttons'))->toBe('both');
});

it('checks the product card and product page settings', function () {
    shabeStoreOwner();
    saveDesign(designDraft(['settings' => [
        'product_card' => ['image' => 'blob', 'button' => 'huge', 'border_width' => 9, 'border_color' => 'red', 'radius' => 50],
        'product_page' => ['gallery' => 'wall', 'related' => 'random', 'sticky_buttons' => 'all', 'viewers' => ['enabled' => true, 'min' => 500, 'max' => 400, 'every' => 1]],
    ]]))->assertStatus(422)->assertJsonValidationErrors([
        'draft.settings.product_card.image', 'draft.settings.product_card.button', 'draft.settings.product_card.border_width', 'draft.settings.product_card.border_color', 'draft.settings.product_card.radius',
        'draft.settings.product_page.gallery', 'draft.settings.product_page.related', 'draft.settings.product_page.sticky_buttons',
        'draft.settings.product_page.viewers.max', 'draft.settings.product_page.viewers.every',
    ]);
    saveDesign(designDraft(['settings' => ['product_page' => ['viewers' => ['min' => 0, 'max' => 1000000]]]]))->assertStatus(422)
        ->assertJsonValidationErrors(['draft.settings.product_page.viewers.min', 'draft.settings.product_page.viewers.max']);
});

it('suggests similar products on the product page when the theme asks for them', function () {
    $owner = shabeStoreOwner();
    [$kofta, $grill] = asTenant($owner, function () {
        $grill = Category::query()->create(['name' => 'مشويات', 'slug' => 'grill', 'is_visible' => true, 'depth' => 0, 'position' => 1]);
        $sweets = Category::query()->create(['name' => 'حلويات', 'slug' => 'sweets', 'is_visible' => true, 'depth' => 0, 'position' => 2]);
        $make = fn (string $name, string $slug, ?Category $c) => tap(Product::factory()->create(['name' => $name, 'slug' => $slug]), fn ($p) => $c ? $p->categories()->attach($c->id) : null);
        $kofta = $make('كفتة مشوية بالبقدونس', 'kofta', $grill);
        $make('كفته داوود باشا', 'dawood', $sweets);      // shares «كفته» (ة = ه), another category
        $make('فراخ مشوية', 'chicken', $grill);           // shares «مشويه» and the category
        $make('كنافة بالقشطة', 'kunafa', $sweets);        // nothing in common

        return [$kofta, $grill];
    });
    $this->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
    $host = 'design-'.$owner->tenant_id.'.localhost';
    $page = fn () => $this->getJson('/api/v1/public/store/products/kofta?host='.$host, internalHeaders())->assertOk()->json('data.related.*.slug');

    saveDesign(designDraft(['settings' => ['product_page' => ['related' => 'similar']]]))->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    expect($page())->toBe(['chicken', 'dawood']);

    saveDesign(designDraft(['settings' => ['product_page' => ['related' => 'category']]]))->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    expect($page())->toBe(['chicken']);
    unset($kofta, $grill);
});
