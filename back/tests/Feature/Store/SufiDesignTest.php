<?php

declare(strict_types=1);

use App\Billing\Themes\ThemeAccess;
use App\Models\Category;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Product;
use App\Models\Tenant;
use App\Models\User;
use App\Store\Design\SufiDesign;
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

/** A store owner on «صوفي» (bought), in the Builder. */
function sufiOwner(): User
{
    $owner = designOwner();
    app(ThemeAccess::class)->grant($owner->tenant, SufiDesign::KEY, 'purchase', null, 99000);
    test()->getJson('/api/v1/dashboard/store/design')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['theme_key' => SufiDesign::KEY])->assertOk();

    return $owner;
}

it('switches a store that bought «صوفي» to its starter design with dark colors and its sections', function () {
    sufiOwner();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk()
        ->assertJsonPath('data.theme.key', 'sufi')
        ->assertJsonPath('data.draft.settings.colors.primary', '#b9844f')
        ->assertJsonPath('data.draft.settings.colors_dark.background', '#111215')
        ->assertJsonPath('data.draft.settings.appearance', ['default' => 'light', 'toggle' => true])
        ->assertJsonPath('data.draft.settings.header.layout', 'center');
    expect(array_column($res->json('data.draft.sections'), 'type'))->toBe(['hero', 'marquee', 'categories', 'product_tabs', 'features', 'testimonials', 'faq']);

    // The starter design is valid as it is.
    saveDesign(designDraft())->assertOk();
});

it('refuses «صوفي» to a store that did not buy it', function () {
    designOwner();
    $this->getJson('/api/v1/dashboard/store/design')->assertOk();

    $this->putJson('/api/v1/dashboard/store', ['theme_key' => SufiDesign::KEY])->assertStatus(422)->assertJsonValidationErrors(['theme_key']);
});

it('saves all sixteen sections and gives each one its data', function () {
    $owner = sufiOwner();
    [$media, $shoes, $bag, $watch] = asTenant($owner, function () {
        $media = Media::factory()->create();
        $shoes = Category::query()->create(['name' => 'أحذية', 'slug' => 'shoes', 'media_id' => $media->id]);
        $bag = Product::factory()->create(['name' => 'شنطة']);
        $watch = Product::factory()->create(['name' => 'ساعة']);
        $watch->categories()->attach($shoes->id);

        return [$media, $shoes, $bag, $watch];
    });
    $link = ['type' => 'category', 'target_id' => $shoes->id, 'url' => null];
    $none = ['type' => 'none', 'target_id' => null, 'url' => null];
    $section = fn (string $type, array $props) => ['id' => $type.'-1x', 'type' => $type, 'visible' => true, 'props' => $props];

    $draft = designDraft();
    $draft['settings']['general']['offers_tab'] = ['enabled' => true, 'label' => 'عروض', 'link' => ['type' => 'offers', 'target_id' => null, 'url' => null]];
    $draft['sections'] = [
        $section('hero', ['slides' => [['media_id' => $media->id, 'title' => 'أناقة', 'text' => null, 'button_label' => 'تسوّق', 'link' => $link]], 'autoplay' => true, 'height' => 'full', 'merge_header' => true, 'shade' => 40, 'kicker' => 'شتاء 2026']),
        $section('marquee', ['items' => ['شحن سريع', '<b>دفع</b> عند الاستلام'], 'speed' => 'fast']),
        $section('categories', ['title' => 'الأقسام', 'description' => null, 'category_ids' => [$shoes->id], 'shape' => 'circle', 'layout' => 'grid', 'columns_desktop' => 6, 'columns_mobile' => 3]),
        $section('product_tabs', ['title' => 'اختياراتنا', 'description' => null, 'limit' => 8, 'tabs' => [
            ['label' => 'يدوي', 'source' => 'manual', 'category_id' => null, 'product_ids' => [$watch->id, $bag->id]],
            ['label' => 'أحذية', 'source' => 'category', 'category_id' => $shoes->id, 'product_ids' => []],
        ]]),
        $section('banners', ['items' => [['media_id' => $media->id, 'kicker' => null, 'title' => 'الشتاء', 'button_label' => 'اكتشف', 'link' => $link]]]),
        $section('countdown', ['media_id' => $media->id, 'kicker' => null, 'title' => 'الجمعة البيضاء', 'text' => null, 'button_label' => 'الحق', 'link' => ['type' => 'offers', 'target_id' => null, 'url' => null], 'ends_at' => '2030-01-01T20:00:00+02:00', 'on_end' => 'ended']),
        $section('featured_product', ['product_id' => $watch->id, 'kicker' => 'الأكثر طلبًا']),
        $section('products', ['title' => 'وصل حديثًا', 'description' => null, 'source' => 'latest', 'category_id' => null, 'limit' => 4, 'layout' => 'grid', 'columns' => 4, 'show_view_all' => true]),
        $section('video', ['url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'title' => 'شوف', 'text' => null, 'cover_media_id' => null]),
        $section('brands', ['title' => 'براندات', 'items' => [['media_id' => $media->id, 'name' => 'A', 'link' => $none], ['media_id' => $media->id, 'name' => 'B', 'link' => $none]]]),
        $section('story', ['kicker' => 'قصتنا', 'title' => 'بدأنا من محل', 'text' => 'من 2018', 'media_id' => $media->id, 'media2_id' => null, 'stats' => [['value' => '+40K', 'label' => 'عميل']], 'button_label' => null, 'link' => $none]),
        $section('features', ['title' => null, 'items' => [['icon' => 'truck', 'title' => 'شحن', 'text' => null], ['icon' => 'cash', 'title' => 'كاش', 'text' => null]]]),
        $section('testimonials', ['title' => 'آراء', 'source' => 'auto', 'items' => []]),
        $section('gallery', ['title' => '@store', 'description' => null, 'items' => array_fill(0, 3, ['media_id' => $media->id, 'label' => null, 'link' => $none])]),
        $section('faq', ['title' => 'أسئلة', 'text' => null, 'whatsapp_button' => true, 'items' => [['question' => 'الشحن؟', 'answer' => 'يومين']]]),
        $section('location', ['title' => 'فروعنا', 'description' => null, 'branches' => [['name' => 'مدينة نصر', 'address' => 'عباس العقاد', 'hours' => '10 ص - 11 م', 'phone' => null, 'map_url' => 'https://maps.app.goo.gl/abc123']]]),
    ];
    $saved = saveDesign($draft)->assertOk();

    expect($saved->json('data.draft.sections.1.props.items.1'))->toBe('دفع عند الاستلام')
        // Stored in UTC whatever offset the Builder sent.
        ->and($saved->json('data.draft.sections.5.props.ends_at'))->toBe('2030-01-01T18:00:00Z');

    $data = $this->getJson('/api/v1/dashboard/store/design')->assertOk()->json('data.data');
    expect(array_column($data['products']['product_tabs-1x:0'], 'name'))->toBe(['ساعة', 'شنطة'])
        ->and(array_column($data['products']['product_tabs-1x:1'], 'name'))->toBe(['ساعة'])
        ->and($data['category_tiles']['categories-1x'][0]['name'])->toBe('أحذية')
        ->and($data['featured']['featured_product-1x']['product']['name'])->toBe('ساعة')
        ->and($data['links']['hero-1x:0'])->toBe('/categories/shoes')
        ->and($data['links']['countdown-1x'])->toBe('/offers')
        ->and($data['links']['offers_tab'])->toBe('/offers')
        ->and($data['media'])->toHaveKey((string) $media->id);

    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
});

it('validates the «صوفي» sections', function () {
    sufiOwner();
    $section = fn (string $type, array $props) => ['id' => $type.'-1x', 'type' => $type, 'visible' => true, 'props' => $props];
    $draft = designDraft();
    $draft['settings']['colors_dark']['background'] = 'black';
    $draft['sections'] = [
        $section('video', ['url' => 'https://example.com/video.mp4', 'title' => null, 'text' => null, 'cover_media_id' => null]),
        $section('location', ['title' => null, 'description' => null, 'branches' => [['name' => 'فرع', 'address' => 'عنوان', 'hours' => null, 'phone' => null, 'map_url' => 'https://example.com/map']]]),
        $section('countdown', ['media_id' => null, 'kicker' => null, 'title' => 'عرض', 'text' => null, 'button_label' => null, 'link' => ['type' => 'none', 'target_id' => null, 'url' => null], 'on_end' => 'hide']),
        $section('product_tabs', ['title' => null, 'description' => null, 'limit' => 8, 'tabs' => [['label' => 'يدوي', 'source' => 'manual', 'category_id' => null, 'product_ids' => []]]]),
    ];

    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors([
        'draft.settings.colors_dark.background',
        'draft.sections.0.props.url',
        'draft.sections.1.props.branches.0.map_url',
        'draft.sections.2.props.ends_at',
        'draft.sections.3.props.tabs.0.product_ids',
    ]);
});

it('saves the header and footer sizes, the dark logo and the floating buttons\' own numbers', function () {
    $owner = sufiOwner();
    $logo = asTenant($owner, fn () => Media::factory()->create());

    saveDesign(designDraft(['settings' => [
        'logo_dark_media_id' => $logo->id,
        'header' => ['height' => 'lg', 'logo_size' => 'sm'],
        'footer' => ['logo' => false, 'logo_size' => 'lg'],
        'general' => ['call_phone' => '01011112222', 'whatsapp_number' => '+20 100 333 4444'],
    ]]))->assertOk();

    $this->getJson('/api/v1/dashboard/store/design')->assertOk()
        ->assertJsonPath('data.draft.settings.logo_dark_media_id', $logo->id)
        ->assertJsonPath('data.draft.settings.header.height', 'lg')
        ->assertJsonPath('data.draft.settings.header.logo_size', 'sm')
        ->assertJsonPath('data.draft.settings.footer.logo', false)
        ->assertJsonPath('data.draft.settings.footer.logo_size', 'lg')
        ->assertJsonPath('data.draft.settings.general.call_phone', '01011112222')
        ->assertJsonPath('data.draft.settings.general.whatsapp_number', '+20 100 333 4444');

    saveDesign(designDraft(['settings' => ['header' => ['height' => 'huge'], 'general' => ['call_phone' => 'call me']]]))
        ->assertStatus(422)->assertJsonValidationErrors(['draft.settings.header.height', 'draft.settings.general.call_phone']);
});

it('keeps designs saved before these settings valid, with the defaults', function () {
    sufiOwner();
    $draft = designDraft();
    unset($draft['settings']['header']['height'], $draft['settings']['header']['logo_size'], $draft['settings']['footer']['logo'], $draft['settings']['general']['call_phone'], $draft['settings']['logo_dark_media_id']);

    saveDesign($draft)->assertOk();
    $this->getJson('/api/v1/dashboard/store/design')->assertOk()
        ->assertJsonPath('data.draft.settings.header.height', 'md')
        ->assertJsonPath('data.draft.settings.footer.logo', true)
        ->assertJsonPath('data.draft.settings.general.call_phone', null)
        ->assertJsonPath('data.draft.settings.logo_dark_media_id', null);
});

it('shows the reviews as a slider by default or as a list, nothing else', function () {
    sufiOwner();
    $draft = designDraft();
    $at = array_search('testimonials', array_column($draft['sections'], 'type'), true);
    expect($draft['sections'][$at]['props']['layout'])->toBe('slider');

    $draft['sections'][$at]['props']['layout'] = 'list';
    saveDesign($draft)->assertOk()->assertJsonPath("data.draft.sections.{$at}.props.layout", 'list');

    $draft['sections'][$at]['props']['layout'] = 'carousel';
    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors(["draft.sections.{$at}.props.layout"]);
});
