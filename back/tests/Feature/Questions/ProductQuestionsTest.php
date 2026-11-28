<?php

declare(strict_types=1);

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\CopilotTools;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Enums\NotificationEvent;
use App\Http\Controllers\Api\V1\Public\StoreController as PublicStoreController;
use App\Jobs\RevalidateTenantHosts;
use App\Models\CopilotChat;
use App\Models\Domain;
use App\Models\Identity;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\ProductQuestion;
use App\Models\Store;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\FormToken;
use App\Tenancy\Tenancy;
use Database\Seeders\ThemeSeeder;
use Illuminate\Support\Facades\Queue;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

/*
 * Stage S3 (docs/plans/tekno/PLAN.md §3): a visitor asks about a product, the merchant answers and publishes it, the
 * product page shows the published answers; the store's switch, bots, the hourly limit, staff, isolation, copilot.
 */

const PQ_HOST = 'questions.localhost';

beforeEach(function () {
    Queue::fake([RevalidateTenantHosts::class]);
    $this->seed(ThemeSeeder::class);
    $this->tenant = Tenant::factory()->onPlan('pro')->create();
    $this->owner = User::factory()->for($this->tenant)->create();
    Domain::factory()->for($this->tenant)->create(['host' => PQ_HOST, 'active_host' => PQ_HOST]);
    asTenant($this->tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs($this->owner->fresh(['tenant']));
    $this->postJson('/api/v1/dashboard/store/setup')->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();
    $this->product = $this->postJson('/api/v1/dashboard/products', ['name' => 'سماعة بلوتوث', 'slug' => 'buds', 'price' => 900, 'in_store' => true])->assertCreated()->json('data.id');
});

/** A valid form token of this store (issued a minute ago: older than the 3-second minimum). */
function pqToken(): string
{
    $store = asTenant(test()->tenant, fn () => Store::query()->firstOrFail());

    return app(FormToken::class)->issue(PublicStoreController::formSubject($store), time() - 60);
}

function pqAsk(array $body = [], string $slug = 'buds'): TestResponse
{
    return test()->postJson("/api/v1/public/store/products/{$slug}/questions", [
        'host' => PQ_HOST, 'name' => 'سارة محمود', 'question' => 'هل السماعة بتشتغل مع آيفون؟', 'form_token' => pqToken(), 'ip' => '10.0.0.1', ...$body,
    ], internalHeaders());
}

/** @return list<array<string, mixed>>|null the product page's published questions (null = questions off) */
function pqPage(): ?array
{
    return test()->getJson('/api/v1/public/store/products/buds?host='.PQ_HOST, internalHeaders())->assertOk()->json('data.questions');
}

/** @return list<ProductQuestion> */
function pqRows(): array
{
    return asTenant(test()->tenant, fn () => ProductQuestion::query()->orderBy('id')->get()->all());
}

it('keeps a visitor question for the merchant, tells him, and shows it only once answered and published', function () {
    pqAsk(['phone' => '01012345678'])->assertStatus(202);

    [$question] = pqRows();
    expect($question->name)->toBe('سارة محمود')->and($question->phone)->toBe('+201012345678')->and($question->status())->toBe('unanswered')
        ->and(pqPage())->toBe(['count' => 0, 'items' => []]);

    $bell = UserNotification::query()->where('user_id', $this->owner->id)->sole();
    expect($bell->event)->toBe(NotificationEvent::ProductQuestion)->and($bell->title)->toContain('سماعة بلوتوث')->and($bell->body)->toContain('آيفون');

    // Answering without publishing keeps it off the page.
    $this->patchJson("/api/v1/dashboard/questions/{$question->id}", ['answer' => 'أيوه، بتشتغل مع أي موبايل بلوتوث.', 'is_published' => false])
        ->assertOk()->assertJsonPath('data.status', 'hidden');
    expect(pqPage()['count'])->toBe(0);

    $this->patchJson("/api/v1/dashboard/questions/{$question->id}", ['is_published' => true])->assertOk()->assertJsonPath('data.status', 'published');
    $page = pqPage();
    // The asker's first name only; the phone never leaves the dashboard.
    expect($page['count'])->toBe(1)->and($page['items'][0])->toMatchArray(['name' => 'سارة م.', 'question' => 'هل السماعة بتشتغل مع آيفون؟', 'answer' => 'أيوه، بتشتغل مع أي موبايل بلوتوث.'])
        ->and($page['items'][0])->not->toHaveKey('phone');
    Queue::assertPushed(RevalidateTenantHosts::class);

    // Emptying the answer takes it back to «مستني رد» and off the page.
    $this->patchJson("/api/v1/dashboard/questions/{$question->id}", ['answer' => ''])->assertOk()->assertJsonPath('data.status', 'unanswered')->assertJsonPath('data.is_published', false);
    expect(pqPage()['count'])->toBe(0);
});

it('checks the visitor form', function () {
    pqAsk(['name' => '', 'question' => 'كده'])->assertStatus(422)->assertJsonValidationErrors(['name', 'question']);
    pqAsk(['phone' => '123'])->assertStatus(422)->assertJsonValidationErrors(['phone']);
    pqAsk(['question' => str_repeat('س', 501)])->assertStatus(422)->assertJsonValidationErrors(['question']);
    // Unknown products and products not in the store.
    pqAsk([], 'nothing-here')->assertNotFound();
    $this->postJson('/api/v1/dashboard/products', ['name' => 'مخفي', 'slug' => 'hidden-one', 'price' => 100, 'in_store' => false])->assertCreated();
    pqAsk([], 'hidden-one')->assertNotFound();
    expect(pqRows())->toBe([]);
});

it('answers bots like everyone and keeps nothing', function () {
    pqAsk(['website' => 'http://spam.example'])->assertStatus(202);
    pqAsk(['form_token' => null])->assertStatus(202);
    pqAsk(['form_token' => app(FormToken::class)->issue('store:999999', time() - 60)])->assertStatus(202);

    expect(pqRows())->toBe([])->and(UserNotification::query()->count())->toBe(0);
});

it('keeps at most 5 questions an hour from one visitor', function () {
    foreach (range(1, 5) as $i) {
        pqAsk(['question' => "سؤال رقم {$i} عن السماعة"])->assertStatus(202);
    }
    pqAsk()->assertStatus(429)->assertJsonPath('code', 'too_many_questions');
    // Another visitor still can.
    pqAsk(['ip' => '10.0.0.2'])->assertStatus(202);
    expect(pqRows())->toHaveCount(6);
});

it('turns questions off for the whole store', function () {
    $this->getJson('/api/v1/dashboard/questions')->assertOk()->assertJsonPath('meta.enabled', true);
    $this->putJson('/api/v1/dashboard/questions/settings', ['enabled' => false])->assertOk()->assertJsonPath('data.enabled', false);
    $this->putJson('/api/v1/dashboard/questions/settings', [])->assertStatus(422)->assertJsonValidationErrors(['enabled']);

    expect(pqPage())->toBeNull();
    pqAsk()->assertNotFound();
    $this->getJson('/api/v1/dashboard/questions')->assertOk()->assertJsonPath('meta.enabled', false);

    $this->putJson('/api/v1/dashboard/questions/settings', ['enabled' => true])->assertOk();
    pqAsk()->assertStatus(202);
});

it('lists the unanswered first with counts, filters and search, and deletes', function () {
    $other = $this->postJson('/api/v1/dashboard/products', ['name' => 'شاحن سريع', 'price' => 300, 'in_store' => true])->assertCreated()->json('data.id');
    $make = fn (int $product, string $text, ?string $answer, bool $published) => asTenant($this->tenant, fn () => ProductQuestion::query()->create([
        'product_id' => $product, 'name' => 'أحمد', 'phone' => '+201000000001', 'question' => $text, 'answer' => $answer, 'answered_at' => $answer === null ? null : now(), 'is_published' => $published,
    ]))->id;
    $published = $make($this->product, 'الضمان كام سنة؟', 'سنة.', true);
    $hidden = $make($other, 'بيشحن الموبايل في قد إيه؟', 'ساعة.', false);
    $waiting = $make($other, 'فيه لون أبيض؟', null, false);

    $all = $this->getJson('/api/v1/dashboard/questions')->assertOk();
    expect(array_column($all->json('data'), 'id'))->toBe([$waiting, $hidden, $published])
        ->and($all->json('meta.counts'))->toBe(['all' => 3, 'unanswered' => 1, 'published' => 1, 'hidden' => 1])
        // The merchant sees the phone and the product.
        ->and($all->json('data.0.phone'))->toBe('+201000000001')->and($all->json('data.0.product.name'))->toBe('شاحن سريع');

    expect(array_column($this->getJson('/api/v1/dashboard/questions?status=unanswered')->json('data'), 'id'))->toBe([$waiting])
        ->and(array_column($this->getJson('/api/v1/dashboard/questions?status=published')->json('data'), 'id'))->toBe([$published])
        ->and(array_column($this->getJson('/api/v1/dashboard/questions?status=hidden')->json('data'), 'id'))->toBe([$hidden])
        ->and(array_column($this->getJson('/api/v1/dashboard/questions?q='.urlencode('الضمان'))->json('data'), 'id'))->toBe([$published])
        ->and(array_column($this->getJson('/api/v1/dashboard/questions?q='.urlencode('شاحن'))->json('data'), 'id'))->toBe([$waiting, $hidden])
        ->and(array_column($this->getJson("/api/v1/dashboard/questions?product_id={$this->product}")->json('data'), 'id'))->toBe([$published]);
    $this->getJson('/api/v1/dashboard/questions?status=bad')->assertStatus(422)->assertJsonValidationErrors(['status']);

    // Only an answered question can be published.
    $this->patchJson("/api/v1/dashboard/questions/{$waiting}", ['is_published' => true])->assertStatus(422)->assertJsonValidationErrors(['is_published']);
    $this->patchJson("/api/v1/dashboard/questions/{$waiting}", ['answer' => str_repeat('ر', 2001)])->assertStatus(422)->assertJsonValidationErrors(['answer']);

    $this->deleteJson("/api/v1/dashboard/questions/{$published}")->assertNoContent();
    expect(pqPage()['count'])->toBe(0)->and(array_column(pqRows(), 'id'))->toBe([$hidden, $waiting]);
});

it('needs a signed-in user, and keeps each store\'s questions to itself', function () {
    pqAsk()->assertStatus(202);
    [$question] = pqRows();

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/questions')->assertUnauthorized();
    $this->patchJson("/api/v1/dashboard/questions/{$question->id}", ['answer' => 'x'])->assertUnauthorized();
    $this->deleteJson("/api/v1/dashboard/questions/{$question->id}")->assertUnauthorized();
    $this->putJson('/api/v1/dashboard/questions/settings', ['enabled' => false])->assertUnauthorized();

    actingAsOwner();
    expect($this->getJson('/api/v1/dashboard/questions')->assertOk()->json('data'))->toBe([]);
    $this->patchJson("/api/v1/dashboard/questions/{$question->id}", ['answer' => 'x', 'is_published' => true])->assertNotFound()->assertJsonPath('code', 'not_found');
    $this->deleteJson("/api/v1/dashboard/questions/{$question->id}")->assertNotFound();
    // A product of another store is not a filter of this one.
    $this->getJson("/api/v1/dashboard/questions?product_id={$this->product}")->assertStatus(422);
    expect(pqRows()[0]->answer)->toBeNull();
});

it('lets staff read, answer and delete only with their permissions, and tells only those who can read', function () {
    $reader = User::factory()->for($this->tenant)->create(['role' => 'staff']);
    $reader->givePermissionTo(['questions.view']);
    $other = User::factory()->for($this->tenant)->create(['role' => 'staff']);
    $other->givePermissionTo(['orders.view']);

    pqAsk()->assertStatus(202);
    [$question] = pqRows();
    $told = UserNotification::query()->where('event', NotificationEvent::ProductQuestion->value)->pluck('user_id')->sort()->values()->all();
    expect($told)->toBe([$this->owner->id, $reader->id]);

    app('auth')->forgetGuards();
    Sanctum::actingAs($reader->fresh());
    $this->getJson('/api/v1/dashboard/questions')->assertOk();
    $this->patchJson("/api/v1/dashboard/questions/{$question->id}", ['answer' => 'x'])->assertForbidden();
    $this->deleteJson("/api/v1/dashboard/questions/{$question->id}")->assertForbidden();
    $this->putJson('/api/v1/dashboard/questions/settings', ['enabled' => false])->assertForbidden();

    $reader->givePermissionTo(['questions.update']);
    app('auth')->forgetGuards();
    Sanctum::actingAs($reader->fresh());
    $this->patchJson("/api/v1/dashboard/questions/{$question->id}", ['answer' => 'أيوه.', 'is_published' => true])->assertOk();

    app('auth')->forgetGuards();
    Sanctum::actingAs($other->fresh());
    $this->getJson('/api/v1/dashboard/questions')->assertForbidden();
});

it('lets the copilot read questions without the phone and answer them through the same rules', function () {
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $chat = asTenant($this->tenant, fn () => CopilotChat::query()->create(['user_id' => $this->owner->id]));
    $tool = function (string $name, array $args) use ($chat): array {
        $ctx = new CopilotContext($this->tenant->fresh(), $this->owner->fresh(), $chat);

        return (array) Tenancy::runAs($this->tenant->id, fn () => app(CopilotTools::class)->run($name, $args, $ctx))->data;
    };
    pqAsk(['phone' => '01012345678'])->assertStatus(202);
    [$question] = pqRows();

    $found = json_encode($tool('find_records', ['resource' => 'product_questions', 'filters' => ['status' => 'unanswered'], 'show' => true]), JSON_UNESCAPED_UNICODE);
    expect($found)->toContain('آيفون')->toContain('سارة م.')->not->toContain('1012345678')->not->toContain('محمود');

    // Publishing without an answer is refused before anything is proposed.
    $refused = json_encode($tool('update_records', ['resource' => 'product_questions', 'selector' => ['ids' => [$question->id]], 'changes' => ['is_published' => ['set' => true]]]), JSON_UNESCAPED_UNICODE);
    expect($refused)->toContain('اكتب الرد الأول');

    $change = $tool('update_records', ['resource' => 'product_questions', 'selector' => ['ids' => [$question->id]], 'changes' => ['answer' => ['set' => 'أيوه، بتشتغل مع آيفون.'], 'is_published' => ['set' => true]]]);
    $this->postJson("/api/v1/dashboard/ai/copilot/change-sets/{$change['change_set_id']}/accept")->assertStatus(202);

    expect(pqPage()['items'][0]['answer'])->toBe('أيوه، بتشتغل مع آيفون.');
});
