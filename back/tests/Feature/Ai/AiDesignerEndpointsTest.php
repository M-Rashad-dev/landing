<?php

declare(strict_types=1);

use App\Ai\AiClient;
use App\Ai\AiError;
use App\Ai\AiWallets;
use App\Ai\Designer\AiDesigner;
use App\Ai\FakeAiClient;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Models\AiSection;
use App\Models\AiUsage;
use App\Models\AiWalletEntry;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\PlanFeatureValue;
use App\Models\Product;
use App\Models\StoreDesign;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

/** A Pro store with a set-up store (theme asas_store), the designer on and a topped-up AI balance. */
function designerOwner(int $balanceCents = 10000): User
{
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => true], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $user = User::factory()->for($tenant)->create();
    Sanctum::actingAs($user->fresh(['tenant']));
    test()->postJson('/api/v1/dashboard/store/setup')->assertOk();
    if ($balanceCents > 0) {
        app(AiWallets::class)->credit($tenant, $balanceCents, 'topup');
    }

    return $user;
}

function designerChat(): int
{
    return (int) test()->postJson('/api/v1/dashboard/ai/designer/chat', ['kind' => 'store', 'theme_key' => 'asas_store'])->assertOk()->json('data.chat.id');
}

/** Sends a message (the fake answers with its fixed section) and returns the new version id. */
function designerSectionVersion(int $chat): int
{
    test()->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'اعملي قسم بنر ومنتجات'])->assertStatus(202);
    $messages = test()->getJson("/api/v1/dashboard/ai/designer/chats/{$chat}")->assertOk()->json('data.messages');
    $last = end($messages);
    expect($last['status'])->toBe('done')->and($last['version'])->not->toBeNull();

    return (int) $last['version']['id'];
}

function charges(int $tenantId): int
{
    return Tenancy::runAs($tenantId, fn () => AiWalletEntry::query()->where('type', 'charge')->count());
}

it('refuses guests', function () {
    $this->postJson('/api/v1/dashboard/ai/designer/chat', ['kind' => 'store', 'theme_key' => 'asas_store'])->assertUnauthorized();
    $this->getJson('/api/v1/dashboard/ai/sections?kind=store&theme_key=asas_store')->assertUnauthorized();
});

it('opens the chat of the store theme only and validates it', function () {
    designerOwner();

    expect(designerChat())->toBe(designerChat());
    $this->postJson('/api/v1/dashboard/ai/designer/chat', ['kind' => 'store', 'theme_key' => 'sufi_store'])->assertStatus(422);
    $this->postJson('/api/v1/dashboard/ai/designer/chat', ['kind' => 'nope', 'theme_key' => 'asas_store'])->assertStatus(422);
    $this->getJson('/api/v1/dashboard/ai/designer/status')->assertOk()->assertJsonPath('data.enabled', true);
});

it('makes a section, charges the reply once, approves it into «أقسامي» once', function () {
    $owner = designerOwner();
    $version = designerSectionVersion(designerChat());

    expect(charges($owner->tenant_id))->toBe(1);
    $this->postJson("/api/v1/dashboard/ai/designer/versions/{$version}/approve")->assertOk();
    $this->postJson("/api/v1/dashboard/ai/designer/versions/{$version}/approve")->assertStatus(409);
    $this->getJson('/api/v1/dashboard/ai/sections?kind=store&theme_key=asas_store')->assertOk()->assertJsonCount(1, 'data');
});

it('keeps the balance and the chat to their own store', function () {
    $first = designerOwner();
    $chat = designerChat();
    $version = designerSectionVersion($chat);

    designerOwner();
    $this->getJson("/api/v1/dashboard/ai/designer/chats/{$chat}")->assertNotFound();
    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'x'])->assertNotFound();
    $this->postJson("/api/v1/dashboard/ai/designer/versions/{$version}/approve")->assertNotFound();
    expect(charges($first->tenant_id))->toBe(1);
});

it('refuses up front when the balance is too low or the designer is off, charging nothing', function () {
    $owner = designerOwner(0);
    $chat = designerChat();

    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'قسم'])->assertStatus(422)->assertJsonPath('code', 'ai_balance_low');
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false]]);
    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'قسم'])->assertStatus(422);
    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => ''])->assertStatus(422);
    expect(charges($owner->tenant_id))->toBe(0);
});

it('edits a section calmly: low temperature, and the merchant\'s fields are kept', function () {
    $owner = designerOwner();
    $chat = designerChat();
    $this->postJson('/api/v1/dashboard/ai/designer/versions/'.designerSectionVersion($chat).'/approve')->assertOk();
    $section = Tenancy::runAs($owner->tenant_id, fn () => AiSection::query()->with('current')->sole());
    $oldKeys = array_column($section->current->fields, 'key');

    // The edit drops every field: they must come back (the merchant didn't ask to remove anything).
    /** @var FakeAiClient $ai */
    $ai = app(AiClient::class);
    $ai->answer(json_encode(['reply' => 'تمام، صلّحت الموبايل.', 'action' => 'section', 'section' => [
        'edit_of' => $section->id, 'name' => $section->name, 'html' => '<section class="w"><p>نص</p></section>', 'css' => '.w{display:block}', 'fields' => [],
    ]], JSON_UNESCAPED_UNICODE));
    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'خلي الموبايل كارت واحد', 'focus_section_id' => $section->id])->assertStatus(202);

    $call = end($ai->chats);
    expect($call['options']['temperature'] ?? null)->toBe(AiDesigner::EDIT_TEMPERATURE);
    $messages = $this->getJson("/api/v1/dashboard/ai/designer/chats/{$chat}")->json('data.messages');
    $edited = end($messages)['version'];
    expect(array_column($edited['fields'], 'key'))->toEqualCanonicalizing($oldKeys);
});

it('puts an approved section in the store design, stamps its version on publish, and refuses another theme\'s', function () {
    $owner = designerOwner();
    $version = designerSectionVersion(designerChat());
    $section = $this->postJson("/api/v1/dashboard/ai/designer/versions/{$version}/approve")->assertOk()->json('data.section.id');

    $design = $this->getJson('/api/v1/dashboard/store/design')->assertOk()->json('data');
    $draft = $design['draft'];
    $draft['sections'][] = ['id' => 'aisec0000001', 'type' => 'ai', 'visible' => true, 'props' => ['ai_section_id' => $section, 'values' => [], 'version_id' => 999]];
    $saved = $this->putJson('/api/v1/dashboard/store/design', ['draft' => $draft, 'version' => $design['version']])->assertOk()->json('data');
    $ai = collect($saved['draft']['sections'])->firstWhere('type', 'ai');
    expect($ai['props'])->not->toHaveKey('version_id')
        ->and($saved['data']['ai_sections'] ?? [])->not->toBeEmpty();

    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    $published = Tenancy::runAs($owner->tenant_id, fn () => StoreDesign::query()->where('theme_key', 'asas_store')->value('published'));
    expect(collect($published['sections'])->firstWhere('type', 'ai')['props']['version_id'])->toBe($version);

    // A section made for another theme is refused here.
    $other = Tenancy::runAs($owner->tenant_id, fn () => AiSection::query()->create(['kind' => 'store', 'theme_key' => 'sufi_store', 'name' => 'x', 'current_version_id' => $version])->id);
    $draft = $saved['draft'];
    $draft['sections'][] = ['id' => 'aisec0000002', 'type' => 'ai', 'visible' => true, 'props' => ['ai_section_id' => $other, 'values' => []]];
    $this->putJson('/api/v1/dashboard/store/design', ['draft' => $draft, 'version' => $saved['version']])->assertStatus(422);
});

it('rejects a proposal without touching anything, and archives a saved section', function () {
    designerOwner();
    $chat = designerChat();
    $rejected = designerSectionVersion($chat);
    $this->postJson("/api/v1/dashboard/ai/designer/versions/{$rejected}/reject")->assertOk();
    $this->postJson("/api/v1/dashboard/ai/designer/versions/{$rejected}/approve")->assertStatus(409);
    $this->getJson('/api/v1/dashboard/ai/sections?kind=store&theme_key=asas_store')->assertOk()->assertJsonCount(0, 'data');

    $section = $this->postJson('/api/v1/dashboard/ai/designer/versions/'.designerSectionVersion($chat).'/approve')->json('data.section.id');
    $this->deleteJson("/api/v1/dashboard/ai/sections/{$section}")->assertNoContent();
    $this->getJson('/api/v1/dashboard/ai/sections?kind=store&theme_key=asas_store')->assertOk()->assertJsonCount(0, 'data');
});

it('repairs a broken answer once (two charges), and charges nothing when the AI fails', function () {
    $owner = designerOwner();
    $chat = designerChat();
    /** @var FakeAiClient $ai */
    $ai = app(AiClient::class);
    $ai->answer('[]', json_encode(['reply' => 'تمام، دي فكرة حلوة.', 'action' => 'none'], JSON_UNESCAPED_UNICODE));
    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'إيه رأيك؟'])->assertStatus(202);
    expect(charges($owner->tenant_id))->toBe(2);

    $ai->answer(new AiError('OpenRouter 502'));
    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'تاني'])->assertStatus(202);
    $messages = $this->getJson("/api/v1/dashboard/ai/designer/chats/{$chat}")->json('data.messages');
    expect(end($messages)['status'])->toBe('failed')->and(charges($owner->tenant_id))->toBe(2);
});

it('runs a whole design, applies it to the draft, reverts it, and never touches products', function () {
    $owner = designerOwner(100000);
    $product = Tenancy::runAs($owner->tenant_id, fn () => Product::factory()->create(['name' => 'منتج ثابت']));
    $chat = designerChat();

    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'صمم المتجر كله'])->assertStatus(202);
    $messages = $this->getJson("/api/v1/dashboard/ai/designer/chats/{$chat}")->json('data.messages');
    $planMessage = end($messages);
    expect($planMessage['plan'] ?? null)->not->toBeNull();

    $run = $this->postJson("/api/v1/dashboard/ai/designer/messages/{$planMessage['id']}/run", ['custom' => ['c1' => false]])->assertStatus(202)->json('data.id');
    $this->getJson("/api/v1/dashboard/ai/designer/runs/{$run}")->assertOk()->assertJsonPath('data.status', 'proposed');

    $before = $this->getJson('/api/v1/dashboard/store/design')->json('data');
    $this->postJson("/api/v1/dashboard/ai/designer/runs/{$run}/apply", ['version' => $before['version'] + 99])->assertStatus(409);
    $this->postJson("/api/v1/dashboard/ai/designer/runs/{$run}/apply", ['version' => $before['version']])->assertOk();
    $applied = $this->getJson('/api/v1/dashboard/store/design')->json('data');
    expect($applied['draft'])->not->toEqual($before['draft']);

    $this->postJson("/api/v1/dashboard/ai/designer/runs/{$run}/revert", ['version' => $applied['version']])->assertOk();
    expect($this->getJson('/api/v1/dashboard/store/design')->json('data.draft'))->toEqual($before['draft'])
        ->and(Tenancy::runAs($owner->tenant_id, fn () => $product->fresh()->name))->toBe('منتج ثابت');
});

it('edits a merchant photo into the store library, charged, and only from this store\'s images', function () {
    Storage::fake('public');
    Storage::fake('local');
    $owner = designerOwner();
    $chat = designerChat();
    $media = $this->post('/api/v1/dashboard/media', ['files' => [UploadedFile::fake()->image('mug.jpg', 800, 800)]], ['Accept' => 'application/json'])
        ->assertSuccessful()->json('data.0.id');
    $before = Tenancy::runAs($owner->tenant_id, fn () => Media::query()->count());

    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$chat}/messages", ['text' => 'شيل الخلفية', 'media_ids' => [$media]])->assertStatus(202);
    $messages = $this->getJson("/api/v1/dashboard/ai/designer/chats/{$chat}")->json('data.messages');
    $reply = end($messages);

    expect($reply['status'])->toBe('done')
        ->and($reply['media'])->not->toBeEmpty()
        ->and(Tenancy::runAs($owner->tenant_id, fn () => Media::query()->count()))->toBe($before + count($reply['media']))
        // The image call is recorded (the fake costs 0; real calls are charged by OpenRouter's reported cost).
        ->and(AiUsage::query()->where('tenant_id', $owner->tenant_id)->where('images', '>', 0)->where('ok', true)->count())->toBe(count($reply['media']));

    // Another store's image can't be attached.
    designerOwner();
    $other = designerChat();
    $this->postJson("/api/v1/dashboard/ai/designer/chats/{$other}/messages", ['text' => 'شيل الخلفية', 'media_ids' => [$media]])->assertStatus(422);
});

it('puts an approved section in a landing page, stamps it on publish, keeps the order form, refuses another theme\'s', function () {
    $owner = designerOwner();
    $product = Tenancy::runAs($owner->tenant_id, fn () => Product::factory()->create());
    Tenancy::runAs($owner->tenant_id, fn () => Identity::query()->exists() || Identity::factory()->default()->create());
    $page = $this->postJson('/api/v1/dashboard/pages', ['title' => 'عرض', 'slug' => 'offer', 'theme_key' => 'bidaya_landing', 'product_id' => $product->id])->assertCreated()->json('data');

    $chat = (int) $this->postJson('/api/v1/dashboard/ai/designer/chat', ['kind' => 'landing', 'theme_key' => 'bidaya_landing', 'landing_page_id' => $page['id']])->assertOk()->json('data.chat.id');
    $this->postJson('/api/v1/dashboard/ai/designer/chat', ['kind' => 'landing', 'theme_key' => 'shabe_landing', 'landing_page_id' => $page['id']])->assertStatus(422);
    $version = designerSectionVersion($chat);
    $section = $this->postJson("/api/v1/dashboard/ai/designer/versions/{$version}/approve")->assertOk()->json('data.section.id');

    $content = $page['draft_content'];
    $content['sections'][] = ['id' => 'aisec0000003', 'type' => 'ai', 'visible' => true, 'props' => ['ai_section_id' => $section, 'values' => []]];
    $saved = $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => $page['version'], 'content' => $content])->assertOk()->json('data');
    expect(collect($saved['draft_content']['sections'])->where('type', 'order_form')->count())->toBe(1);

    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish")->assertOk();
    $published = Tenancy::runAs($owner->tenant_id, fn () => LandingPage::query()->find($page['id'])->published_content);
    expect(collect($published['sections'])->firstWhere('type', 'ai')['props']['version_id'])->toBe($version);

    $other = Tenancy::runAs($owner->tenant_id, fn () => AiSection::query()->create(['kind' => 'store', 'theme_key' => 'asas_store', 'name' => 'x', 'current_version_id' => $version])->id);
    $content['sections'][] = ['id' => 'aisec0000004', 'type' => 'ai', 'visible' => true, 'props' => ['ai_section_id' => $other, 'values' => []]];
    $this->putJson("/api/v1/dashboard/pages/{$page['id']}/content", ['version' => $saved['version'], 'content' => $content])->assertStatus(422);
});
