<?php

declare(strict_types=1);

use App\Billing\Themes\ThemeAccess;
use App\Models\Category;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Media;
use App\Models\Product;
use App\Models\StoreQuizResult;
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
        ->assertJsonPath('data.theme.settings_groups', ['look', 'header', 'footer', 'general', 'product_card', 'product_page', 'listing', 'cart'])
        ->assertJsonPath('data.draft.settings.product_page.related', 'similar')
        ->assertJsonPath('data.draft.settings.product_page.promises.0', 'أصلي 100%')
        ->assertJsonPath('data.draft.settings.cart.order_notes', false)
        ->assertJsonPath('data.draft.settings.colors.primary', '#b9507a')
        ->assertJsonPath('data.draft.settings.colors.dark', '#2b2226')
        ->assertJsonPath('data.draft.settings.product_card.tinted', true)
        ->assertJsonPath('data.draft.settings.footer.payments', true);
    expect(array_column($res->json('data.draft.sections'), 'type'))->toBe(['glow_hero', 'features', 'shortcuts', 'shortcuts', 'product_tabs', 'ingredients', 'skin_quiz', 'testimonials', 'cta'])
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

it('saves its product page, category pages and cart settings, checks them, and gives old designs their defaults', function () {
    rawaqOwner();
    $draft = designDraft();
    $draft['settings']['product_page'] = [...$draft['settings']['product_page'], 'gallery' => 'slider', 'promises' => ['<b>مرخّص</b>', 'أصلي'], 'viewers' => ['enabled' => true, 'min' => 20, 'max' => 60, 'every' => 10]];
    $draft['settings']['listing']['columns_mobile'] = 1;
    $draft['settings']['cart']['order_notes'] = true;
    saveDesign($draft)->assertOk();
    $this->getJson('/api/v1/dashboard/store/design')
        ->assertJsonPath('data.draft.settings.product_page.gallery', 'slider')
        ->assertJsonPath('data.draft.settings.product_page.promises', ['مرخّص', 'أصلي'])
        ->assertJsonPath('data.draft.settings.product_page.viewers.max', 60)
        ->assertJsonPath('data.draft.settings.listing.columns_mobile', 1)
        ->assertJsonPath('data.draft.settings.cart.order_notes', true);

    $bad = designDraft();
    $bad['settings']['product_page']['promises'] = ['1', '2', '3', '4', '5'];
    $bad['settings']['product_page']['viewers'] = ['enabled' => true, 'min' => 90, 'max' => 10, 'every' => 1];
    $bad['settings']['listing']['columns_desktop'] = 9;
    $bad['settings']['cart']['suggestions'] = 'random';
    saveDesign($bad)->assertStatus(422)->assertJsonValidationErrors([
        'draft.settings.product_page.promises', 'draft.settings.product_page.viewers.max', 'draft.settings.product_page.viewers.every',
        'draft.settings.listing.columns_desktop', 'draft.settings.cart.suggestions',
    ]);

    // A design saved before stage 2 (no page groups) gets their defaults.
    $old = designDraft();
    unset($old['settings']['product_page'], $old['settings']['listing'], $old['settings']['cart']);
    saveDesign($old)->assertOk();
    $this->getJson('/api/v1/dashboard/store/design')
        ->assertJsonPath('data.draft.settings.product_page.sticky_buttons', 'cart')
        ->assertJsonPath('data.draft.settings.listing.filters', 'button')
        ->assertJsonPath('data.draft.settings.cart.suggestions', 'offers');
});

/** The starter design's quiz section, published (the public quiz endpoint counts published quizzes only). */
function rawaqQuiz(): array
{
    $draft = designDraft();
    $quiz = collect($draft['sections'])->firstWhere('type', 'skin_quiz');
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    test()->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();

    return $quiz;
}

function quizPost(string $host, array $body)
{
    return test()->postJson('/api/v1/public/store/quiz', ['host' => $host] + $body, internalHeaders());
}

it('saves before/after, tips and a skin quiz, and sends each quiz result its products and category, and the search links', function () {
    $owner = rawaqOwner();
    [$category, $serum, $before, $after] = asTenant($owner, fn () => [
        Category::query()->create(['name' => 'بشرة دهنية', 'slug' => 'oily', 'depth' => 0, 'position' => 0, 'is_visible' => true]),
        Product::factory()->create(['name' => 'سيروم', 'in_store' => true]),
        Media::factory()->create(),
        Media::factory()->create(),
    ]);
    $draft = designDraft();
    $draft['sections'] = [
        ['id' => 'beforeafter1', 'type' => 'before_after', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'الفرق بيبان', 'text' => null, 'before_media_id' => $before->id, 'after_media_id' => $after->id, 'before_label' => 'قبل', 'after_label' => 'بعد 4 أسابيع', 'facts' => [['value' => '92%', 'label' => 'بشرتهم بقت أنعم']]]],
        ['id' => 'articles0001', 'type' => 'articles', 'visible' => true, 'props' => ['kicker' => null, 'title' => 'نصايح', 'items' => [
            ['media_id' => null, 'tag' => 'البشرة', 'title' => 'ترتيب منتجاتك', 'body' => "<b>من الأخف</b>\nللأتقل", 'link' => ['type' => 'none', 'target_id' => null, 'url' => null]],
            ['media_id' => null, 'tag' => null, 'title' => 'منتجات بالنياسيناميد', 'body' => null, 'link' => ['type' => 'search', 'target_id' => null, 'url' => 'نياسيناميد']],
        ]]],
        ['id' => 'quiz00000001', 'type' => 'skin_quiz', 'visible' => true, 'props' => [
            'kicker' => null, 'title' => 'اعرفي روتينك', 'text' => null, 'button_label' => null,
            'results' => [
                ['id' => 'oily', 'name' => 'دهنية', 'text' => null, 'product_ids' => [$serum->id, $serum->id], 'category_id' => $category->id],
                // The same product may be recommended by two results.
                ['id' => 'dry', 'name' => 'جافة', 'text' => null, 'product_ids' => [$serum->id], 'category_id' => null],
            ],
            'questions' => [
                ['text' => 'آخر اليوم؟', 'answers' => [['text' => 'لامعة', 'results' => ['oily']], ['text' => 'ناشفة', 'results' => ['dry', 'dry']]]],
                ['text' => 'الكريمات؟', 'answers' => [['text' => 'حبوب', 'results' => ['oily']], ['text' => 'بتريحني', 'results' => ['dry']]]],
            ],
        ]],
    ];
    saveDesign($draft)->assertOk();

    $res = $this->getJson('/api/v1/dashboard/store/design')->assertOk();
    expect($res->json('data.draft.sections.1.props.items.0.body'))->toBe("من الأخف\nللأتقل")
        ->and($res->json('data.draft.sections.2.props.questions.0.answers.1.results'))->toBe(['dry'])
        ->and($res->json('data.data.links')['articles0001:1'])->toBe('/products?q='.rawurlencode('نياسيناميد'))
        ->and($res->json('data.data.links')['quiz00000001:0'])->toBe('/categories/oily')
        ->and($res->json('data.data.links')['quiz00000001:1'])->toBeNull()
        ->and($res->json('data.draft.sections.2.props.results.0.product_ids'))->toBe([$serum->id])
        ->and(array_column($res->json('data.data.products')['quiz00000001:1'], 'name'))->toBe(['سيروم'])
        ->and(array_column($res->json('data.data.products')['quiz00000001:0'], 'name'))->toBe(['سيروم'])
        ->and($res->json('data.data.media'))->toHaveKeys([(string) $before->id, (string) $after->id]);
});

it('checks the quiz: answers point at its own results, and before/after needs both pictures', function () {
    rawaqOwner();
    $draft = designDraft();
    $draft['sections'] = [
        ['id' => 'quiz00000001', 'type' => 'skin_quiz', 'visible' => true, 'props' => [
            'kicker' => null, 'title' => '', 'text' => null, 'button_label' => null,
            'results' => [['id' => 'oily', 'name' => 'دهنية', 'text' => null, 'product_ids' => [], 'category_id' => null], ['id' => 'oily', 'name' => 'تاني', 'text' => null, 'product_ids' => [], 'category_id' => null]],
            'questions' => [['text' => 'سؤال', 'answers' => [['text' => 'أ', 'results' => ['ghost']], ['text' => 'ب', 'results' => []]]]],
        ]],
        ['id' => 'beforeafter1', 'type' => 'before_after', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'text' => null, 'before_media_id' => null, 'after_media_id' => null, 'before_label' => 'قبل', 'after_label' => 'بعد', 'facts' => []]],
        ['id' => 'articles0001', 'type' => 'articles', 'visible' => true, 'props' => ['kicker' => null, 'title' => null, 'items' => [['media_id' => null, 'tag' => null, 'title' => 'x', 'body' => null, 'link' => ['type' => 'search', 'target_id' => null, 'url' => null]]]]],
    ];

    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors([
        'draft.sections.0.props.title', 'draft.sections.0.props.results.0.id', 'draft.sections.0.props.questions',
        'draft.sections.0.props.questions.0.answers.0.results.0', 'draft.sections.0.props.questions.0.answers.1.results',
        'draft.sections.1.props.before_media_id', 'draft.sections.1.props.after_media_id',
        'draft.sections.2.props.items.0.link.url',
    ]);
});

it('counts each finished quiz per result for the merchant, only for a published quiz of that store, at most 10 a day per visitor', function () {
    $owner = rawaqOwner();
    $quiz = rawaqQuiz();
    $host = 'design-'.$owner->tenant_id.'.localhost';

    quizPost($host, ['section_id' => $quiz['id'], 'result_id' => 'oily'])->assertStatus(202);
    quizPost($host, ['section_id' => $quiz['id'], 'result_id' => 'oily'])->assertStatus(202);
    quizPost($host, ['section_id' => $quiz['id'], 'result_id' => 'dry'])->assertStatus(202);
    // Unknown section or result: nothing counted (still 202: visitors learn nothing).
    quizPost($host, ['section_id' => 'nosuchsection', 'result_id' => 'oily'])->assertStatus(202);
    quizPost($host, ['section_id' => $quiz['id'], 'result_id' => 'ghost'])->assertStatus(202);
    quizPost($host, ['section_id' => '<script>', 'result_id' => 'OILY!'])->assertStatus(422)->assertJsonValidationErrors(['section_id', 'result_id']);

    $res = $this->getJson('/api/v1/dashboard/store/design/quiz-results')->assertOk();
    expect($res->json('data.0.total'))->toBe(3)
        ->and(collect($res->json('data.0.results'))->pluck('count', 'id')->all())->toMatchArray(['oily' => 2, 'dry' => 1, 'combo' => 0, 'sensitive' => 0]);

    // The 10th request of the day is the last one counted for this visitor.
    for ($i = 0; $i < 4; $i++) {
        quizPost($host, ['section_id' => $quiz['id'], 'result_id' => 'combo'])->assertStatus(202);
    }
    quizPost($host, ['section_id' => $quiz['id'], 'result_id' => 'combo'])->assertStatus(429);

    // Another store sees its own numbers only; signed out → 401.
    rawaqOwner();
    $this->getJson('/api/v1/dashboard/store/design/quiz-results')->assertOk()->assertJsonPath('data.0.total', 0);
    expect(StoreQuizResult::query()->withoutGlobalScopes()->where('tenant_id', $owner->tenant_id)->sum('count'))->toEqual(7);
    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/store/design/quiz-results')->assertUnauthorized();
});
