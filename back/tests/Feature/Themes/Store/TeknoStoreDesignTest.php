<?php

declare(strict_types=1);

use App\Billing\Themes\ThemeAccess;
use App\Models\Category;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Order;
use App\Models\Product;
use App\Models\StorePage;
use App\Models\Tenant;
use App\Models\User;
use App\Themes\Store\TeknoStoreDesign;
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

/** A store owner on «تيكنو» (bought), in the Builder. */
function teknoOwner(): User
{
    $owner = designOwner();
    app(ThemeAccess::class)->grant($owner->tenant, TeknoStoreDesign::KEY, 'purchase', null, 99000);
    test()->getJson('/api/v1/dashboard/store/design')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['theme_key' => TeknoStoreDesign::KEY])->assertOk();

    return $owner;
}

const TEKNO_NONE = ['type' => 'none', 'target_id' => null, 'url' => null];
const TEKNO_ALL = ['type' => 'all_products', 'target_id' => null, 'url' => null];

/** A slide of the opening as the Builder sends it. */
function tkSlide(array $changes = []): array
{
    return [...['kicker' => null, 'title' => 'لابتوب', 'highlight' => null, 'subtitle' => null, 'media_id' => null, 'chips' => [], 'product_id' => null, 'button_label' => 'اشتري', 'link' => TEKNO_ALL, 'second_label' => null, 'second_link' => TEKNO_NONE], ...$changes];
}

function tkDeal(array $changes = []): array
{
    return [...['kicker' => null, 'product_id' => null, 'title' => null, 'chips' => null, 'ends' => 'midnight', 'ends_at' => null, 'stock_start' => null, 'button_label' => 'الحق العرض', 'show_installment' => true], ...$changes];
}

it('switches a store that bought «تيكنو» to its electronics starter design, its section types and its settings', function () {
    teknoOwner();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk()
        ->assertJsonPath('data.theme.key', 'tekno_store')
        ->assertJsonPath('data.theme.section_types', TeknoStoreDesign::SECTION_TYPES)
        ->assertJsonPath('data.theme.settings_groups', ['look', 'header', 'footer', 'general', 'mega_menu', 'product_card', 'installments'])
        ->assertJsonPath('data.draft.settings.colors.primary', '#2563eb')
        ->assertJsonPath('data.draft.settings.colors.dark', '#0f1a2e')
        ->assertJsonPath('data.draft.settings.colors.deal', '#a3e635')
        ->assertJsonPath('data.draft.settings.header.search_categories', true)
        ->assertJsonPath('data.draft.settings.header.hotline', null)
        ->assertJsonPath('data.draft.settings.product_card.badge_label', 'الحالة')
        ->assertJsonPath('data.draft.settings.installments.months', [6, 12, 18, 24])
        ->assertJsonPath('data.draft.settings.installments.card_months', 12)
        ->assertJsonPath('data.draft.settings.mega_menu', ['enabled' => true, 'items' => []]);
    $sections = $res->json('data.draft.sections');
    expect(array_column($sections, 'type'))->toBe(['tech_hero', 'features', 'categories', 'product_tabs', 'brands', 'services', 'testimonials'])
        ->and(count($sections[1]['props']['items']))->toBe(5)
        ->and(array_column($sections[3]['props']['tabs'], 'source'))->toBe(['best_sellers', 'latest', 'offers'])
        // The brands wait hidden for the merchant's own.
        ->and($sections[4]['visible'])->toBeFalse()
        ->and($res->json('data.data.links'))->toHaveKeys([$sections[0]['id'].':0', $sections[0]['id'].':0:second', $sections[0]['id'].':tile:1'])
        ->and($res->json('data.data.links')[$sections[0]['id'].':tile:0'])->toBe('/products?q='.rawurlencode('سماعات'));

    // The starter design saves as it is.
    saveDesign(designDraft())->assertOk();
});

it('refuses «تيكنو» to a store that did not buy it', function () {
    designOwner();
    $this->getJson('/api/v1/dashboard/store/design')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['theme_key' => TeknoStoreDesign::KEY])->assertStatus(422);
});

it('saves its sections and sends what they show: real prices, the deal product, best sellers, links and the mega menu', function () {
    $owner = teknoOwner();
    [$laptops, $student, $laptop, $watch, $help] = asTenant($owner, function () {
        $laptops = Category::query()->create(['name' => 'لابتوبات', 'slug' => 'laptops', 'depth' => 0, 'position' => 0, 'is_visible' => true]);
        $student = Category::query()->create(['name' => 'لابتوبات الطلبة', 'slug' => 'student', 'parent_id' => $laptops->id, 'depth' => 1, 'position' => 0, 'is_visible' => true]);
        $laptop = Product::factory()->create(['name' => 'لابتوب 14', 'slug' => 'laptop-14', 'in_store' => true, 'price' => '24999.00', 'compare_at_price' => '27500.00']);
        $watch = Product::factory()->create(['name' => 'ساعة ذكية', 'in_store' => true, 'price' => '2599.00', 'stock_mode' => Product::STOCK_PRODUCT, 'stock' => 14]);
        $mouse = Product::factory()->create(['name' => 'ماوس', 'in_store' => true]);
        // The mouse sold more than the laptop.
        $order = Order::factory()->create();
        $order->items()->create(['product_id' => $mouse->id, 'product_name' => 'ماوس', 'unit_price' => '450.00', 'quantity' => 5, 'line_total' => '2250.00']);
        $order->items()->create(['product_id' => $laptop->id, 'product_name' => 'لابتوب', 'unit_price' => '24999.00', 'quantity' => 1, 'line_total' => '24999.00']);
        $help = StorePage::query()->create(['title' => 'الضمان والصيانة', 'slug' => 'warranty', 'body' => 'سنتين', 'is_published' => true]);

        return [$laptops, $student, $laptop, $watch, $help];
    });
    $draft = designDraft();
    $draft['settings']['header']['hotline'] = '19999';
    $draft['settings']['footer']['help_links'] = [$help->id];
    $draft['settings']['mega_menu']['items'] = [[
        'category_id' => $laptops->id,
        'columns' => [['title' => 'حسب الاستخدام', 'links' => [['label' => 'للدراسة', 'link' => ['type' => 'category', 'target_id' => $student->id, 'url' => null]], ['label' => 'للجيمنج', 'link' => ['type' => 'search', 'target_id' => null, 'url' => 'جيمنج']]]]],
        'promo' => ['media_id' => null, 'title' => 'لابتوبات الطلبة', 'text' => 'خصم لحد 20%', 'link' => ['type' => 'category', 'target_id' => $student->id, 'url' => null]],
    ]];
    $draft['settings']['installments']['months'] = [24, 6, 12];
    $draft['sections'] = [
        ['id' => 'techhero001', 'type' => 'tech_hero', 'visible' => true, 'props' => [
            'slides' => [tkSlide(['product_id' => $laptop->id, 'chips' => ['Core i5', '16GB'], 'second_label' => 'المواصفات', 'second_link' => ['type' => 'product', 'target_id' => $laptop->id, 'url' => null]])],
            'tiles' => [['media_id' => null, 'kicker' => 'سماعات', 'title' => 'صوت نقي', 'text' => 'من 1,499 ج.م', 'color' => '#0E7490', 'link' => ['type' => 'category', 'target_id' => $laptops->id, 'url' => null]]],
        ]],
        ['id' => 'dealofday01', 'type' => 'deal_of_day', 'visible' => true, 'props' => tkDeal(['product_id' => $watch->id, 'chips' => ['GPS'], 'stock_start' => 50, 'ends' => 'date', 'ends_at' => '2026-12-31T23:00:00+02:00'])],
        ['id' => 'tabs0000001', 'type' => 'product_tabs', 'visible' => true, 'props' => ['title' => 'اختار جهازك', 'description' => null, 'limit' => 10, 'tabs' => [['label' => 'الأكثر مبيعًا', 'source' => 'best_sellers', 'category_id' => null, 'product_ids' => []]], 'kicker' => 'الأكثر طلبًا']],
        ['id' => 'features001', 'type' => 'features', 'visible' => true, 'props' => ['title' => null, 'items' => array_map(fn ($icon) => ['icon' => $icon, 'title' => 'ميزة', 'text' => null], ['badge-check', 'return', 'tag', 'truck', 'wrench'])]],
        ['id' => 'services001', 'type' => 'services', 'visible' => true, 'props' => ['title' => 'الضمان', 'items' => [['icon' => 'headset', 'title' => 'دعم فني', 'text' => '<b>واتساب</b>'], ['icon' => 'wrench', 'title' => 'صيانة', 'text' => null]]]],
        ['id' => 'brands00001', 'type' => 'brands', 'visible' => true, 'props' => ['title' => null, 'items' => [['media_id' => null, 'name' => 'NOVA', 'link' => TEKNO_NONE], ['media_id' => null, 'name' => 'ZENTRO', 'link' => TEKNO_NONE]]]],
        ['id' => 'reviews0001', 'type' => 'testimonials', 'visible' => true, 'props' => ['title' => 'آراء العملاء', 'source' => 'manual', 'items' => [['name' => 'أحمد · القاهرة', 'rating' => 5, 'text' => 'ممتاز', 'product' => 'لابتوب 14"']]]],
    ];
    saveDesign($draft)->assertOk();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk();
    $links = $res->json('data.data.links');
    $products = $res->json('data.data.products');
    $saved = $res->json('data.draft');
    expect($saved['settings']['installments']['months'])->toBe([6, 12, 24])
        ->and($saved['settings']['header']['hotline'])->toBe('19999')
        ->and($saved['sections'][0]['props']['tiles'][0]['color'])->toBe('#0e7490')
        ->and($saved['sections'][1]['props']['ends_at'])->toBe('2026-12-31T21:00:00Z')
        ->and($saved['sections'][2]['props']['kicker'])->toBe('الأكثر طلبًا')
        ->and($saved['sections'][4]['props']['items'][0]['text'])->toBe('واتساب')
        ->and($saved['sections'][6]['props']['items'][0]['product'])->toBe('لابتوب 14"')
        // The slide's price is the product's, never typed.
        ->and($products['techhero001:0'][0]['price'])->toEqual(24999)
        ->and($products['techhero001:0'][0]['compare_at_price'])->toEqual(27500)
        ->and($links['techhero001:0:second'])->toBe('/products/laptop-14')
        ->and($links['techhero001:tile:0'])->toBe('/categories/laptops')
        ->and($products['dealofday01'][0]['name'])->toBe('ساعة ذكية')
        ->and($products['dealofday01'][0]['max_quantity'])->toBe(14)
        ->and(array_column($products['tabs0000001:0'], 'name'))->toBe(['ماوس', 'لابتوب 14', 'ساعة ذكية'])
        ->and($links['mega:0:0:0'])->toBe('/categories/student')
        ->and($links['mega:0:0:1'])->toBe('/products?q='.rawurlencode('جيمنج'))
        ->and($links['mega:0:promo'])->toBe('/categories/student')
        ->and($res->json('data.data.pages'))->toBe([['id' => $help->id, 'title' => 'الضمان والصيانة', 'slug' => 'warranty']]);
});

it('checks its sections and settings', function () {
    $owner = teknoOwner();
    $laptop = asTenant($owner, fn () => Product::factory()->create(['in_store' => true]));
    [$foreignProduct, $foreignCategory, $foreignPage] = asTenant(Tenant::factory()->create(), fn () => [
        Product::factory()->create(),
        Category::query()->create(['name' => 'غريب', 'slug' => 'x', 'depth' => 0, 'position' => 0, 'is_visible' => true]),
        StorePage::query()->create(['title' => 'غريبة', 'slug' => 'x', 'body' => 'x', 'is_published' => true]),
    ]);
    $draft = designDraft();
    $draft['settings']['colors']['deal'] = 'lime';
    $draft['settings']['header']['hotline'] = 'call me';
    $draft['settings']['footer']['help_links'] = [$foreignPage->id];
    $draft['settings']['mega_menu']['items'] = [['category_id' => $foreignCategory->id, 'columns' => [['title' => '', 'links' => []]], 'promo' => ['media_id' => null, 'title' => '', 'text' => null, 'link' => ['type' => 'url', 'target_id' => null, 'url' => 'javascript:alert(1)']]]];
    $draft['settings']['product_card']['low_stock'] = 50;
    $draft['settings']['installments']['months'] = [6, 5];
    $draft['settings']['installments']['card_months'] = 36;
    $draft['settings']['installments']['interest_percent'] = 150;
    $draft['sections'] = [
        ['id' => 'techhero001', 'type' => 'tech_hero', 'visible' => true, 'props' => ['slides' => [], 'tiles' => []]],
        ['id' => 'techhero002', 'type' => 'tech_hero', 'visible' => true, 'props' => ['slides' => [tkSlide(['title' => '', 'product_id' => $foreignProduct->id, 'chips' => ['a', 'b', 'c', 'd', 'e']])], 'tiles' => [['media_id' => null, 'kicker' => null, 'title' => 'x', 'text' => null, 'color' => 'blue', 'link' => TEKNO_NONE]]]],
        ['id' => 'dealofday01', 'type' => 'deal_of_day', 'visible' => true, 'props' => tkDeal(['ends' => 'date'])],
        ['id' => 'dealofday02', 'type' => 'deal_of_day', 'visible' => true, 'props' => tkDeal(['product_id' => $laptop->id, 'ends' => 'tomorrow', 'button_label' => ''])],
        ['id' => 'features001', 'type' => 'features', 'visible' => true, 'props' => ['title' => null, 'items' => array_fill(0, 6, ['icon' => 'rocket', 'title' => 'x', 'text' => null])]],
        ['id' => 'brands00001', 'type' => 'brands', 'visible' => true, 'props' => ['title' => null, 'items' => [['media_id' => null, 'name' => null, 'link' => TEKNO_NONE], ['media_id' => null, 'name' => 'GRID', 'link' => TEKNO_NONE]]]],
        ['id' => 'services001', 'type' => 'services', 'visible' => true, 'props' => ['title' => null, 'items' => [['icon' => 'wrench', 'title' => 'x', 'text' => null]]]],
        // Another theme's section is not «تيكنو»'s.
        ['id' => 'glowhero001', 'type' => 'glow_hero', 'visible' => true, 'props' => []],
    ];

    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors([
        'draft.settings.colors.deal', 'draft.settings.header.hotline', 'draft.settings.footer.help_links.0',
        'draft.settings.mega_menu.items.0.category_id', 'draft.settings.mega_menu.items.0.columns.0.title', 'draft.settings.mega_menu.items.0.columns.0.links',
        'draft.settings.mega_menu.items.0.promo.title', 'draft.settings.mega_menu.items.0.promo.link.url',
        'draft.settings.product_card.low_stock',
        'draft.settings.installments.months.1', 'draft.settings.installments.card_months', 'draft.settings.installments.interest_percent',
        'draft.sections.0.props.slides',
        'draft.sections.1.props.slides.0.title', 'draft.sections.1.props.slides.0.product_id', 'draft.sections.1.props.slides.0.chips', 'draft.sections.1.props.tiles.0.color',
        'draft.sections.2.props.product_id', 'draft.sections.2.props.ends_at',
        'draft.sections.3.props.ends', 'draft.sections.3.props.button_label',
        'draft.sections.4.props.items', 'draft.sections.4.props.items.0.icon',
        'draft.sections.5.props.items.0.name',
        'draft.sections.6.props.items',
        'draft.sections.7.type',
    ]);
});

it('lets another theme\'s brands be names only too', function () {
    // «رواق» offers brands too: a brand without a logo is its name.
    $owner = designOwner();
    app(ThemeAccess::class)->grant($owner->tenant, 'rawaq_store', 'purchase', null, 99000);
    $this->getJson('/api/v1/dashboard/store/design')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['theme_key' => 'rawaq_store'])->assertOk();
    $draft = designDraft();
    $draft['sections'] = [['id' => 'brands00001', 'type' => 'brands', 'visible' => true, 'props' => ['title' => null, 'items' => [['media_id' => null, 'name' => 'NOVA', 'link' => TEKNO_NONE], ['media_id' => null, 'name' => 'GRID', 'link' => TEKNO_NONE]]]]];
    saveDesign($draft)->assertOk();
    expect($this->getJson('/api/v1/dashboard/store/design')->json('data.draft.sections.0.props.items.0'))->toBe(['media_id' => null, 'name' => 'NOVA', 'link' => TEKNO_NONE]);
});
