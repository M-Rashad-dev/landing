<?php

declare(strict_types=1);

use App\Ai\AiClient;
use App\Ai\AiWallets;
use App\Ai\FakeAiClient;
use App\Billing\PlatformSettings;
use App\Billing\Themes\ThemeAccess;
use App\Jobs\EmbedProductVectors;
use App\Models\AiUsage;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\Product;
use App\Models\StoreQuizResult;
use App\Models\Tenant;
use App\Models\User;
use App\Themes\Store\RawaqStoreDesign;
use Illuminate\Support\Facades\Queue;
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

beforeEach(function () {
    // The dollar at 50 EGP: the AI quiz on, paid from the store's balance.
    app(PlatformSettings::class)->save(['ai_features' => ['quiz' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 0, 'ai_welcome_credit' => 0]);
});

/**
 * A live «رواق» store whose published quiz has the AI add-on (2 results, 2 questions), with products.
 *
 * @return array{0: User, 1: string, 2: list<Product>}
 */
function aiQuizStore(array $ai = [], int $products = 3, int $credit = 100): array
{
    $owner = designOwner();
    app(ThemeAccess::class)->grant($owner->tenant, RawaqStoreDesign::KEY, 'purchase', null, 99000);
    test()->putJson('/api/v1/dashboard/store', ['theme_key' => RawaqStoreDesign::KEY, 'is_enabled' => true])->assertOk();
    $items = asTenant($owner->tenant, fn () => collect(range(1, $products))->map(fn (int $i) => Product::factory()->create(['name' => "منتج {$i}", 'in_store' => true]))->all());
    if ($credit > 0) {
        app(AiWallets::class)->credit($owner->tenant, $credit * 100, 'gift', 'هدية');
    }
    $draft = designDraft();
    $draft['sections'] = [['id' => 'quiz00000001', 'type' => 'skin_quiz', 'visible' => true, 'props' => [
        'kicker' => null, 'title' => 'اعرفي روتينك', 'text' => null, 'button_label' => null,
        'results' => [
            ['id' => 'oily', 'name' => 'دهنية', 'text' => 'منظف خفيف', 'product_ids' => [$items[0]->id], 'category_id' => null],
            ['id' => 'dry', 'name' => 'جافة', 'text' => null, 'product_ids' => [], 'category_id' => null],
        ],
        'questions' => [
            ['text' => 'آخر اليوم؟', 'answers' => [['text' => 'لامعة', 'results' => ['oily']], ['text' => 'ناشفة', 'results' => ['dry']]]],
            ['text' => 'الكريمات؟', 'answers' => [['text' => 'حبوب', 'results' => ['oily']], ['text' => 'بتريحني', 'results' => ['dry']]]],
        ],
        'ai' => [...['enabled' => true, 'open_question' => true, 'open_label' => null, 'scope' => 'all', 'category_ids' => [], 'product_ids' => []], ...$ai],
    ]]];
    saveDesign($draft)->assertOk();
    test()->postJson('/api/v1/dashboard/store/design/publish')->assertOk();

    return [$owner, 'design-'.$owner->tenant_id.'.localhost', $items];
}

function advice(string $host, array $body)
{
    return test()->postJson('/api/v1/public/store/quiz/advice', ['host' => $host, 'section_id' => 'quiz00000001'] + $body, internalHeaders());
}

/** What the model was given about the finished quiz (the JSON line of the first call's message). */
function quizPayload(): array
{
    return json_decode(explode("\n", (string) quizAi()->chats[0]['messages'][1]['content'])[1], true);
}

function quizAi(): FakeAiClient
{
    return app(AiClient::class);
}

it('recommends a result and the store\'s products with a short text, charges the merchant once, and keeps the same answers\' pick', function () {
    [$owner, $host, $items] = aiQuizStore();
    $before = app(AiWallets::class)->spendableCents($owner->tenant);

    $res = advice($host, ['answers' => [0, 0], 'note' => '<b>بشرتي</b> بتلمع'])->assertOk()
        ->assertJsonPath('data.source', 'ai')->assertJsonPath('data.result_id', 'oily');
    expect($res->json('data.text'))->toContain('منتج')
        ->and(array_column($res->json('data.products'), 'name'))->toHaveCount(3);

    // What the model was given: the merchant's results, the answers as text, the note as plain data, the store's products only.
    $payload = quizPayload();
    expect($payload['customer_note'])->toBe('بشرتي بتلمع')
        ->and($payload['answers'][0])->toBe(['question' => 'آخر اليوم؟', 'answer' => 'لامعة'])
        ->and(array_column($payload['products'], 'id'))->toEqualCanonicalizing(array_map(fn ($p) => $p->id, $items))
        ->and(quizAi()->chats[0]['model'])->toBe('qwen/qwen4-max');
    expect(app(AiWallets::class)->spendableCents($owner->tenant->fresh()))->toBeLessThan($before);

    // Same answers: same pick, no new call; both counted as AI results.
    advice($host, ['answers' => [0, 0], 'note' => 'بشرتي بتلمع'])->assertOk()->assertJsonPath('data.source', 'ai');
    expect(quizAi()->chats)->toHaveCount(1)
        ->and(AiUsage::query()->where('feature', 'quiz')->count())->toBe(1)
        ->and(StoreQuizResult::query()->withoutGlobalScopes()->where('tenant_id', $owner->tenant_id)->first()->only(['result_id', 'count', 'ai_count']))->toBe(['result_id' => 'oily', 'count' => 2, 'ai_count' => 2]);
});

it('uses only the merchant\'s scope and checks every pick the model makes', function () {
    [$owner, $host, $items] = aiQuizStore([], 4);
    $draft = designDraft();
    $draft['sections'][0]['props']['ai'] = ['enabled' => true, 'open_question' => false, 'open_label' => null, 'scope' => 'products', 'category_ids' => [], 'product_ids' => [$items[1]->id, $items[2]->id]];
    saveDesign($draft)->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    quizAi()->answer((string) json_encode(['result_id' => 'ghost', 'text' => 'زوري https://evil.example <script>x</script>كده', 'product_ids' => [$items[3]->id, $items[2]->id, 999999]]));

    $res = advice($host, ['answers' => [1, 1], 'note' => 'مش هيتبعت'])->assertOk()->assertJsonPath('data.source', 'ai')
        // «ghost» isn't a result: the vote result. Product 4 is outside the scope, 999999 isn't the store's.
        ->assertJsonPath('data.result_id', 'dry');
    expect(array_column($res->json('data.products'), 'id'))->toBe([$items[2]->id])
        ->and($res->json('data.text'))->toBe('زوري xكده');
    $payload = quizPayload();
    expect(array_column($payload['products'], 'id'))->toEqualCanonicalizing([$items[1]->id, $items[2]->id])
        // The open question is off: her words are not sent.
        ->and($payload['customer_note'])->toBeNull();
});

it('falls back to the vote result when the add-on is off, the AI is off, or the balance is out, charging nothing', function () {
    [$owner, $host] = aiQuizStore(credit: 0);
    advice($host, ['answers' => [1, 1]])->assertOk()->assertExactJson(['data' => ['source' => 'vote', 'result_id' => 'dry']]);

    app(AiWallets::class)->credit($owner->tenant, 10000, 'gift', 'هدية');
    app(PlatformSettings::class)->save(['ai_features' => ['quiz' => false]]);
    advice($host, ['answers' => [1, 1]])->assertOk()->assertJsonPath('data.source', 'vote');

    app(PlatformSettings::class)->save(['ai_features' => ['quiz' => true]]);
    $draft = designDraft();
    $draft['sections'][0]['props']['ai']['enabled'] = false;
    saveDesign($draft)->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    advice($host, ['answers' => [1, 1]])->assertOk()->assertJsonPath('data.source', 'vote');

    expect(quizAi()->chats)->toBe([])
        ->and(StoreQuizResult::query()->withoutGlobalScopes()->where('tenant_id', $owner->tenant_id)->sum('count'))->toEqual(3)
        ->and(StoreQuizResult::query()->withoutGlobalScopes()->where('tenant_id', $owner->tenant_id)->sum('ai_count'))->toEqual(0);
});

it('stops asking the model once the store reaches its daily limit', function () {
    config(['ai.quiz.store_daily' => 1]);
    [, $host] = aiQuizStore();
    advice($host, ['answers' => [0, 0]])->assertOk()->assertJsonPath('data.source', 'ai');
    advice($host, ['answers' => [1, 1]])->assertOk()->assertJsonPath('data.source', 'vote');
    expect(quizAi()->chats)->toHaveCount(1);
});

it('sends a big catalog\'s nearest products only, keeping the vote result\'s own, and makes the store\'s vectors in the background', function () {
    Queue::fake();
    config(['ai.quiz.candidates' => 5]);
    [$owner, $host, $items] = aiQuizStore([], 3);
    asTenant($owner->tenant, function () {
        Product::factory()->count(6)->create(['in_store' => true, 'name' => 'شامبو']);
        Product::factory()->create(['in_store' => true, 'name' => 'سيروم لامعة للبشرة']);
    });

    advice($host, ['answers' => [0, 0]])->assertOk()->assertJsonPath('data.source', 'ai');
    $names = array_column(quizPayload()['products'], 'name');
    expect($names)->toHaveCount(5)
        // The vote result's own product first, then the words of her answers.
        ->and($names[0])->toBe($items[0]->name)
        ->and($names)->toContain('سيروم لامعة للبشرة');
    Queue::assertPushed(EmbedProductVectors::class, fn (EmbedProductVectors $job) => $job->tenantId === $owner->tenant_id);
});

it('refuses answers that don\'t fit the quiz, an unknown quiz, and AI settings without their products or categories', function () {
    [$owner, $host] = aiQuizStore();
    advice($host, ['answers' => [0]])->assertStatus(422);
    advice($host, ['answers' => [0, 4]])->assertStatus(422)->assertJsonValidationErrors(['answers']);
    $this->postJson('/api/v1/public/store/quiz/advice', ['host' => $host, 'section_id' => 'nosuchquiz', 'answers' => [0, 0]], internalHeaders())->assertNotFound();

    $draft = designDraft();
    $draft['sections'][0]['props']['ai'] = ['enabled' => true, 'open_question' => true, 'open_label' => null, 'scope' => 'categories', 'category_ids' => [], 'product_ids' => []];
    saveDesign($draft)->assertStatus(422)->assertJsonValidationErrors(['draft.sections.0.props.ai.category_ids']);
    // A quiz saved before the add-on (no `ai`) is read as off.
    unset($draft['sections'][0]['props']['ai']);
    saveDesign($draft)->assertOk();
    expect(designDraft()['sections'][0]['props']['ai']['enabled'])->toBeFalse();
});

it('adds the dermatologist line when her words mention something medical and the model left it out', function () {
    [, $host] = aiQuizStore();
    $line = __('ai.quiz.see_doctor');
    expect(advice($host, ['answers' => [0, 0], 'note' => 'عندي إكزيما على الخدود'])->json('data.text'))->toEndWith($line)
        ->and(advice($host, ['answers' => [0, 0], 'note' => 'بشرتي مش بتتحمل الكريمات وعندي دواير'])->json('data.text'))->not->toContain($line)
        ->and(advice($host, ['answers' => [1, 1], 'note' => 'أنا حامل في الشهر الرابع'])->json('data.text'))->toEndWith($line);
});
