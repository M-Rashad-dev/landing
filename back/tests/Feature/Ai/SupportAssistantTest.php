<?php

declare(strict_types=1);

use App\Ai\AiClient;
use App\Ai\AiError;
use App\Ai\FakeAiClient;
use App\Ai\Knowledge;
use App\Billing\PlatformSettings;
use App\Events\SupportUpdated;
use App\Models\AiArticle;
use App\Models\AiArticleChunk;
use App\Models\AiUsage;
use App\Models\Product;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use App\Models\UserNotification;
use Database\Seeders\AiArticleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function () {
    Storage::fake('local');
    Event::fake([SupportUpdated::class]);
});

function assistant(): FakeAiClient
{
    return app(AiClient::class);
}

function assistantOn(array $more = []): void
{
    app(PlatformSettings::class)->save(['ai_features' => ['support' => true]] + $more);
}

/** The assistant's JSON answer. */
function says(string $reply, array $more = []): string
{
    return (string) json_encode([...['reply' => $reply, 'answered' => true, 'handoff' => false, 'reason' => null, 'summary' => null, 'sources' => []], ...$more], JSON_UNESCAPED_UNICODE);
}

/** An article ready for the assistant (its vectors made by the fake client). */
function article(string $title, string $body): AiArticle
{
    $article = AiArticle::query()->create(['title' => $title, 'category' => 'products', 'body' => $body, 'is_active' => true]);
    app(Knowledge::class)->refresh($article);

    return $article->refresh();
}

function ask(string $body, array $more = []): array
{
    return test()->post('/api/v1/dashboard/support/tickets', ['topic' => 'products', 'body' => $body, ...$more], ['Accept' => 'application/json'])->assertCreated()->json('data');
}

function ticketOf(array $data): SupportTicket
{
    return SupportTicket::query()->withoutGlobalScopes()->where('number', $data['ticket']['number'])->firstOrFail();
}

it('answers a new conversation from the knowledge base and the store data, without the staff', function () {
    assistantOn();
    $admin = User::factory()->superAdmin()->create();
    $owner = actingAsOwner();
    asTenant($owner, fn () => Product::factory()->create(['name' => 'ساعة نبض']));
    asTenant(createOwner(), fn () => Product::factory()->create(['name' => 'منتج متجر تاني']));
    // The question's own words make the nearest piece with the fake vectors.
    $product = article('إضافة منتج', 'روح المنتجات ← منتج جديد، واكتب الاسم والسعر وارفع الصور.');
    assistant()->answer(says('روح «المنتجات ← منتج جديد» واكتب الاسم والسعر.', ['sources' => [$product->id, 999]]));

    $data = ask('إضافة منتج
روح المنتجات ← منتج جديد، واكتب الاسم والسعر وارفع الصور.');
    $ticket = ticketOf($data);

    expect($ticket->handler)->toBe('ai')->and($ticket->status->value)->toBe('waiting_merchant');
    $reply = SupportMessage::query()->withoutGlobalScopes()->where('support_ticket_id', $ticket->id)->where('sender', 'ai')->sole();
    expect($reply->body)->toBe('روح «المنتجات ← منتج جديد» واكتب الاسم والسعر.')
        // Only articles it was given count as its sources (999 was never given).
        ->and($reply->sources)->toBe([$product->id])
        ->and(UserNotification::query()->where('user_id', $admin->id)->where('event', 'support_ticket')->exists())->toBeFalse();

    $sent = assistant()->chats[0]['messages'];
    $context = $sent[1]['content'];
    expect($sent[0]['content'])->toContain('مساعد مكسب')
        ->and($context)->toContain('ساعة نبض')->not->toContain('منتج متجر تاني')
        ->and(AiUsage::query()->where('tenant_id', $owner->tenant_id)->where('feature', 'support')->count())->toBe(2); // the question's vector + the answer
});

it('keeps only the articles it was given as sources, shown to the staff only', function () {
    assistantOn();
    $owner = actingAsOwner();
    $piece = article('ربط دومين', 'إزاي أربط دومين؟');
    assistant()->answer(says('من الإعدادات ← الدومين.', ['sources' => [$piece->id]]));

    $number = ask('ربط دومين
إزاي أربط دومين؟')['ticket']['number'];

    $merchantView = $this->getJson("/api/v1/dashboard/support/tickets/{$number}")->assertOk()->json('data.messages');
    expect(collect($merchantView)->firstWhere('sender', 'ai')['sources'])->toBeNull();

    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $staffView = $this->getJson("/api/v1/admin/support/tickets/{$number}")->assertOk()->json('data.messages');
    expect(collect($staffView)->firstWhere('sender', 'ai')['sources'])->toBe([['id' => $piece->id, 'title' => 'ربط دومين']]);
});

it('hands a money dispute to people with its summary, tells the merchant and the staff, and never comes back', function () {
    assistantOn();
    $admin = User::factory()->superAdmin()->create();
    actingAsOwner();
    assistant()->answer(says('هحوّلك لفريق الدعم يراجعوا الدفع.', ['handoff' => true, 'reason' => 'money', 'summary' => 'دفع 500 جنيه والباقة متفعّلتش.']));

    $data = ask('دفعت ومتفعّلتش الباقة!');
    $ticket = ticketOf($data);

    expect($ticket->handler)->toBe('human')
        ->and($ticket->handoff_reason)->toBe('money')
        ->and($ticket->handoff_summary)->toBe('دفع 500 جنيه والباقة متفعّلتش.')
        ->and($ticket->status->value)->toBe('waiting_support');
    $senders = SupportMessage::query()->withoutGlobalScopes()->where('support_ticket_id', $ticket->id)->orderBy('id')->pluck('sender')->all();
    expect($senders)->toBe(['merchant', 'ai', 'system'])
        ->and(UserNotification::query()->where('user_id', $admin->id)->where('event', 'support_ticket')->count())->toBe(1);

    // The merchant writes again: people answer now, not the assistant.
    $this->postJson("/api/v1/dashboard/support/tickets/{$data['ticket']['number']}/messages", ['body' => 'مستني'])->assertCreated();
    expect(assistant()->chats)->toHaveCount(1);
});

it('hands over after two answers that could not help, a reply it cannot read, or the daily limit', function () {
    assistantOn(['ai_support_daily_messages' => 1]);
    // This test is about handing over, not the open limit: it opens several conversations.
    config(['landing.support.max_open' => 20]);
    $owner = actingAsOwner();
    assistant()->answer(says('مش متأكد من دي.', ['answered' => false]), says('برضو مش لاقي.', ['answered' => false]));

    $first = ask('سؤال غريب');
    expect(ticketOf($first)->handler)->toBe('ai');
    // One answer a day for this store: the next question goes to people.
    $this->postJson("/api/v1/dashboard/support/tickets/{$first['ticket']['number']}/messages", ['body' => 'طب وبعدين؟'])->assertCreated();
    expect(ticketOf($first)->handoff_reason)->toBe('limit');

    app(PlatformSettings::class)->save(['ai_support_daily_messages' => 30]);
    assistant()->answer('مش JSON خالص');
    $second = ask('سؤال تاني');
    expect(ticketOf($second)->handoff_reason)->toBe('unavailable');

    assistant()->answer(says('مش متأكد.', ['answered' => false]), says('لسه مش لاقي.', ['answered' => false]));
    $third = ask('سؤال تالت');
    expect(ticketOf($third)->handler)->toBe('ai');
    $this->postJson("/api/v1/dashboard/support/tickets/{$third['ticket']['number']}/messages", ['body' => 'متحلتش'])->assertCreated();
    expect(ticketOf($third)->handoff_reason)->toBe('unsolved')
        ->and($owner->tenant_id)->toBeInt();
});

it('goes to people when the provider fails, and straight to people while the assistant is off', function () {
    assistantOn();
    actingAsOwner();
    assistant()->answer(new AiError('Qwen 500'));
    expect(ticketOf(ask('سؤال'))->handoff_reason)->toBe('unavailable');

    app(PlatformSettings::class)->save(['ai_features' => ['support' => false]]);
    actingAsOwner();
    $off = ticketOf(ask('سؤال والمساعد مقفول'));
    expect($off->handler)->toBe('human')->and($off->handoff_reason)->toBeNull();
});

it('lets the merchant ask for a person, writes a summary for the staff, and refuses it twice', function () {
    assistantOn();
    actingAsOwner();
    assistant()->answer(says('أهلًا، اسألني.'), 'التاجر عايز يكلم موظف عن الشحن.');
    $number = ask('عايز أسأل عن الشحن')['ticket']['number'];

    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/handoff")->assertOk()
        ->assertJsonPath('data.handler', 'human')->assertJsonPath('data.handoff_reason', 'request');
    expect(SupportTicket::query()->withoutGlobalScopes()->where('number', $number)->value('handoff_summary'))->toBe('التاجر عايز يكلم موظف عن الشحن.');

    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/handoff")->assertStatus(422)->assertJsonPath('code', 'support_not_assistant');
    $this->postJson('/api/v1/dashboard/support/tickets/999999/handoff')->assertNotFound();
});

it('keeps the handoff to the store own conversations and needs a signed-in merchant', function () {
    assistantOn();
    actingAsOwner();
    assistant()->answer(says('أهلًا.'));
    $number = ask('سؤال')['ticket']['number'];

    actingAsOwner();
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/handoff")->assertNotFound();

    app('auth')->forgetGuards();
    $this->postJson("/api/v1/dashboard/support/tickets/{$number}/handoff")->assertUnauthorized();
});

it('lets staff take over by answering, and keeps the assistant out of the staff queue', function () {
    assistantOn();
    actingAsOwner();
    assistant()->answer(says('أهلًا.'));
    $number = ask('سؤال')['ticket']['number'];

    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $this->getJson('/api/v1/admin/support/tickets?status=waiting_support')->assertOk()->assertJsonCount(0, 'data');
    $this->getJson('/api/v1/admin/support/tickets?status=ai')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.counts.ai', 1);

    $this->postJson("/api/v1/admin/support/tickets/{$number}/messages", ['body' => 'معاك موظف.'])->assertCreated();
    $ticket = SupportTicket::query()->withoutGlobalScopes()->where('number', $number)->sole();
    expect($ticket->handler)->toBe('human')->and($ticket->handoff_reason)->toBe('staff')
        ->and(SupportMessage::query()->withoutGlobalScopes()->where('support_ticket_id', $ticket->id)->where('sender', 'system')->exists())->toBeFalse();
    $this->getJson('/api/v1/admin/support/stats')->assertOk()->assertJsonPath('data.assistant.handed_off', 1);
});

it('lets the assistant see screenshots, opens without the waiting gap, and keeps the open limit', function () {
    assistantOn();
    actingAsOwner();
    assistant()->answer(says('واضح من الصورة.'), says('تاني.'), says('تالت.'));

    ask('شوف الصورة', ['files' => [UploadedFile::fake()->image('screen.png', 300, 200)]]);
    $parts = collect(assistant()->chats[0]['messages'])->where('role', 'user')->last()['content'];
    expect($parts[1]['type'])->toBe('image')->and($parts[1]['url'])->toStartWith('data:image/png;base64,');

    // A second one right away (no waiting gap with the assistant), but never more than 2 open in all (owner, 2026-11-19).
    ask('سؤال تاني');
    $this->postJson('/api/v1/dashboard/support/tickets', ['topic' => 'other', 'body' => 'سؤال تالت'])->assertStatus(422)->assertJsonPath('code', 'support_limit');
    expect(SupportTicket::query()->withoutGlobalScopes()->where('handler', 'ai')->count())->toBe(2);
});

it('keeps the knowledge base to super admins and validates articles', function () {
    $this->getJson('/api/v1/admin/ai/articles')->assertUnauthorized();
    Sanctum::actingAs(createOwner());
    $this->getJson('/api/v1/admin/ai/articles')->assertForbidden();

    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $this->postJson('/api/v1/admin/ai/articles', ['title' => '', 'category' => 'nope', 'body' => '', 'is_active' => 'x'])
        ->assertStatus(422)->assertJsonValidationErrors(['title', 'category', 'body', 'is_active']);
    $this->putJson('/api/v1/admin/ai/articles/999', ['title' => 'x', 'category' => 'start', 'body' => 'y', 'is_active' => true])->assertNotFound();
});

it('writes articles that wait for the assistant, then get ready once it is on, and can be searched', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $body = "إزاي تضيف منتج.\n\n".str_repeat('خطوة تفصيلية طويلة شوية. ', 60);

    $made = $this->postJson('/api/v1/admin/ai/articles', ['title' => '<b>إضافة منتج</b>', 'category' => 'products', 'body' => $body, 'is_active' => true])
        ->assertCreated()->json('data');
    expect($made['title'])->toBe('إضافة منتج')->and($made['state'])->toBe('waiting')->and($made['pieces'])->toBe(2);

    $this->putJson('/api/v1/admin/ai/settings', ['features' => ['support' => true, 'designer' => false, 'copilot' => false], 'daily_cap_usd' => 20, 'usd_rate' => null, 'margin_percent' => 10, 'support_daily_messages' => 30, 'topup_packages' => [100, 250, 500, 1000], 'topup_min' => 50, 'topup_offers' => [], 'welcome_credit' => 10, 'low_balance' => 10])->assertOk();
    $listed = $this->getJson('/api/v1/admin/ai/articles?category=products')->assertOk()->json('data.0');
    expect($listed['state'])->toBe('ready');

    $piece = AiArticle::query()->findOrFail($made['id'])->chunks()->first();
    expect(app(Knowledge::class)->search($piece->text)[0])->toMatchArray(['article_id' => $made['id'], 'score' => 1.0]);

    $this->putJson("/api/v1/admin/ai/articles/{$made['id']}", ['title' => 'إضافة منتج', 'category' => 'products', 'body' => 'نص قصير', 'is_active' => false])
        ->assertOk()->assertJsonPath('data.pieces', 1)->assertJsonPath('data.is_active', false);
    // Switched off: the assistant no longer reads it.
    expect(array_column(app(Knowledge::class)->search("إضافة منتج\nنص قصير"), 'article_id'))->not->toContain($made['id']);

    $this->deleteJson("/api/v1/admin/ai/articles/{$made['id']}")->assertNoContent();
    expect(AiArticle::query()->whereKey($made['id'])->exists())->toBeFalse();
});

it('starts the knowledge base with the platform articles once, and never over the owner\'s', function () {
    $this->seed(AiArticleSeeder::class);
    expect(AiArticle::query()->count())->toBe(count(AiArticleSeeder::ARTICLES))
        ->and(AiArticle::query()->whereNotIn('category', AiArticle::CATEGORIES)->exists())->toBeFalse()
        ->and(AiArticleChunk::query()->count())->toBeGreaterThanOrEqual(AiArticle::query()->count());

    AiArticle::query()->first()->update(['title' => 'عنوان المالك']);
    $this->seed(AiArticleSeeder::class);
    expect(AiArticle::query()->where('title', 'عنوان المالك')->exists())->toBeTrue()
        ->and(AiArticle::query()->count())->toBe(count(AiArticleSeeder::ARTICLES));
});
