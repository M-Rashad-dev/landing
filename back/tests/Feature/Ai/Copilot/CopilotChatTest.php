<?php

declare(strict_types=1);

use App\Ai\AiClient;
use App\Ai\AiError;
use App\Ai\AiWallets;
use App\Ai\Copilot\CopilotEngine;
use App\Ai\FakeAiClient;
use App\Billing\PlanCatalog;
use App\Billing\PlatformSettings;
use App\Jobs\CopilotReply;
use App\Models\AiUsage;
use App\Models\AiWalletEntry;
use App\Models\CopilotChat;
use App\Models\CopilotMessage;
use App\Models\Media;
use App\Models\Order;
use App\Models\PlanFeatureValue;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;

/** A Pro store with the copilot on and a topped-up AI balance, signed in. */
function copilotOwner(int $balanceCents = 10000, bool $on = true): User
{
    app(PlatformSettings::class)->save(['ai_features' => ['support' => false, 'designer' => false, 'copilot' => $on], 'ai_usd_rate' => 50, 'ai_margin_percent' => 10, 'ai_welcome_credit' => 0]);
    PlanFeatureValue::query()->updateOrCreate(['plan_key' => 'pro', 'entitlement' => 'ai'], ['value' => 1]);
    PlanCatalog::flush();
    $tenant = Tenant::factory()->onPlan('pro')->create();
    $user = User::factory()->for($tenant)->create();
    Sanctum::actingAs($user->fresh(['tenant']));
    if ($balanceCents > 0) {
        app(AiWallets::class)->credit($tenant, $balanceCents, 'topup');
    }

    return $user;
}

function copilot(): FakeAiClient
{
    return app(AiClient::class);
}

function copilotChat(): int
{
    return (int) test()->postJson('/api/v1/dashboard/ai/copilot/chat')->assertOk()->json('data.chat.id');
}

/** Sends a message and returns the assistant's reply as the chat shows it. */
function copilotSay(int $chat, string $text, array $more = []): array
{
    test()->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => $text, ...$more])->assertStatus(202);
    $messages = test()->getJson("/api/v1/dashboard/ai/copilot/chats/{$chat}")->assertOk()->json('data.messages');

    return end($messages);
}

function copilotCharges(User $user): int
{
    return AiWalletEntry::query()->withoutGlobalScopes()->where('tenant_id', $user->tenant_id)->where('type', 'charge')->where('feature', 'copilot')->count();
}

it('shows whether the copilot is on', function () {
    copilotOwner(on: false);
    $this->getJson('/api/v1/dashboard/ai/copilot/status')->assertOk()->assertJsonPath('data.enabled', false);

    copilotOwner();
    $this->getJson('/api/v1/dashboard/ai/copilot/status')->assertOk()->assertJsonPath('data.enabled', true);
});

it('keeps one open chat per user and starts a new one on demand', function () {
    copilotOwner();
    $first = copilotChat();
    expect(copilotChat())->toBe($first);

    $new = (int) $this->postJson('/api/v1/dashboard/ai/copilot/chat/new')->assertOk()->json('data.chat.id');

    expect($new)->not->toBe($first)
        ->and(CopilotChat::query()->withoutGlobalScopes()->find($first)->closed_at)->not->toBeNull()
        ->and(copilotChat())->toBe($new);
});

it('answers a message, charges the reply once and titles the chat', function () {
    $user = copilotOwner();
    $chat = copilotChat();
    copilot()->answer('أهلًا! أقدر أساعدك في متجرك.');

    $reply = copilotSay($chat, 'أهلا يا مساعد');

    expect($reply)->toMatchArray(['role' => 'assistant', 'status' => 'done', 'text' => 'أهلًا! أقدر أساعدك في متجرك.', 'blocks' => []])
        ->and(copilotCharges($user))->toBe(1)
        ->and(AiUsage::query()->where('feature', 'copilot')->count())->toBe(1)
        ->and(CopilotChat::query()->withoutGlobalScopes()->find($chat)->title)->toBe('أهلا يا مساعد');
    $sent = copilot()->chats[0];
    expect($sent['model'])->toBe('anthropic/claude-sonnet-5.5')
        ->and($sent['options']['cache'])->toBeTrue()
        ->and($sent['options']['effort'])->toBe('low')
        ->and(collect($sent['options']['tools'])->pluck('function.name')->all())->toBe(['help_search', 'store_overview', 'open_page'])
        ->and($sent['messages'][0]['content'])->toContain('MKSAB_AI_COPILOT')->toContain('# CATALOG')
        // The new request: the context block, the merchant's words, then the reminder last.
        ->and(end($sent['messages'])['content'][1]['text'])->toBe('أهلا يا مساعد')
        ->and(end(end($sent['messages'])['content'])['text'])->toBe(CopilotEngine::REMINDER);
});

it('runs the tools the model asks for, gives it the results, and charges every round', function () {
    $user = copilotOwner();
    $chat = copilotChat();
    copilot()->answer(FakeAiClient::toolCalls(['store_overview', []], ['no_such_tool', []]), 'باقتك برو.');

    $reply = copilotSay($chat, 'باقتي إيه؟');

    expect($reply['status'])->toBe('done')->and($reply['text'])->toBe('باقتك برو.')
        ->and(copilotCharges($user))->toBe(2);
    $second = copilot()->chats[1]['messages'];
    $tools = array_values(array_filter($second, fn ($m) => $m['role'] === 'tool'));
    expect($second[count($second) - 3]['role'])->toBe('assistant')
        ->and($tools)->toHaveCount(2)
        ->and(json_decode($tools[0]['content'], true))->toHaveKeys(['overview', 'limits'])
        ->and(json_decode($tools[1]['content'], true)['error'])->toContain('Unknown or unavailable tool');
    $trace = CopilotMessage::query()->withoutGlobalScopes()->find($reply['id'])->trace;
    expect($trace['rounds'])->toHaveCount(2)->and($trace['rounds'][0]['tools'][0]['name'])->toBe('store_overview');
});

it('gives a button to the AI designer with the request filled in', function () {
    copilotOwner();
    $chat = copilotChat();
    copilot()->answer(FakeAiClient::toolCall('open_page', ['target' => 'designer', 'prompt' => 'بنر فيه صورة المنتج']), 'افتح المصمم من الزرار.');

    $reply = copilotSay($chat, 'صمملي بنر');

    expect($reply['blocks'])->toHaveCount(1)
        ->and($reply['blocks'][0])->toMatchArray(['type' => 'handoff', 'target' => 'designer', 'label' => 'افتح المصمم الذكي'])
        ->and($reply['blocks'][0]['href'])->toStartWith('/dashboard/design/builder?ai=1&prompt=');
});

it('refuses page paths outside the dashboard', function () {
    copilotOwner();
    $chat = copilotChat();
    copilot()->answer(FakeAiClient::toolCall('open_page', ['target' => 'page', 'path' => 'https://evil.test']), 'تمام');

    $reply = copilotSay($chat, 'افتحلي صفحة');

    $tool = collect(copilot()->chats[1]['messages'])->firstWhere('role', 'tool');
    expect($reply['blocks'])->toBe([])->and(json_decode($tool['content'], true))->toHaveKey('error');
});

it('stops calling tools at the round cap and answers with what it has', function () {
    config(['ai.copilot.max_rounds' => 2]);
    $user = copilotOwner();
    $chat = copilotChat();
    copilot()->answer(FakeAiClient::toolCall('store_overview'), 'ده اللي عرفته.');

    $reply = copilotSay($chat, 'قولي كل حاجة');

    expect($reply['text'])->toBe('ده اللي عرفته.')
        ->and(copilot()->chats)->toHaveCount(2)
        ->and(copilot()->chats[1]['options']['tool_choice'])->toBe('none')
        ->and(end(copilot()->chats[1]['messages'])['content'])->toContain('no more tool calls')
        ->and(copilotCharges($user))->toBe(2);
});

it('stops at the cost cap of one message', function () {
    config(['ai.copilot.max_message_usd' => 0.000001]);
    copilotOwner();
    $chat = copilotChat();
    copilot()->answer(FakeAiClient::toolCall('store_overview'), 'خلصت.');

    copilotSay($chat, 'قولي كل حاجة');

    expect(copilot()->chats)->toHaveCount(2)->and(copilot()->chats[1]['options']['tool_choice'])->toBe('none');
});

it('marks the reply failed and charges nothing when the provider fails', function () {
    $user = copilotOwner();
    $chat = copilotChat();
    copilot()->answer(new AiError('OpenRouter 500'));

    $reply = copilotSay($chat, 'سؤال');

    expect($reply)->toMatchArray(['status' => 'failed', 'error' => 'المساعد مش متاح دلوقتي، جرّب بعد شوية.', 'error_code' => 'ai_unavailable'])
        ->and(copilotCharges($user))->toBe(0);
});

it('refuses before saving anything when the balance is low or the copilot is off', function () {
    copilotOwner(balanceCents: 0);
    $chat = copilotChat();
    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => 'سؤال'])->assertStatus(422)->assertJsonPath('code', 'ai_balance_low');

    copilotOwner(on: false);
    $other = copilotChat();
    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$other}/messages", ['text' => 'سؤال'])->assertStatus(422)->assertJsonPath('code', 'ai_unavailable');

    expect(CopilotMessage::query()->withoutGlobalScopes()->count())->toBe(0)
        ->and(copilot()->chats)->toBe([]);
});

it('refuses a second message while a reply is pending, and fails a reply that never came', function () {
    Queue::fake();
    copilotOwner();
    $chat = copilotChat();
    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => 'أول'])->assertStatus(202)->assertJsonPath('data.status', 'pending');
    Queue::assertPushed(CopilotReply::class);

    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => 'تاني'])->assertStatus(422)->assertJsonPath('code', 'ai_reply_pending');

    $this->travel(CopilotMessage::PENDING_MINUTES + 1)->minutes();
    $messages = $this->getJson("/api/v1/dashboard/ai/copilot/chats/{$chat}")->assertOk()->json('data.messages');
    expect(end($messages))->toMatchArray(['status' => 'failed', 'error' => 'الرد اتأخر، جرّب تاني.']);
});

it('validates the message and keeps images to this store', function () {
    $user = copilotOwner();
    $chat = copilotChat();
    $foreign = asTenant(createOwner(), fn () => Media::factory()->create());

    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => ''])->assertStatus(422)->assertJsonValidationErrors('text');
    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => str_repeat('ا', 2001)])->assertStatus(422)->assertJsonValidationErrors('text');
    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => 'شوف', 'media_ids' => [$foreign->id]])->assertStatus(422)->assertJsonValidationErrors('media_ids.0');

    $own = asTenant($user, fn () => Media::factory()->create());
    copilot()->answer('صورة حلوة.');
    copilotSay($chat, 'شوف الصورة', ['media_ids' => [$own->id]]);
    $parts = end(copilot()->chats[0]['messages'])['content'];
    expect(collect($parts)->where('type', 'image'))->toHaveCount(1);
});

it('keeps a trusted page context and tells the model where the merchant is', function () {
    copilotOwner();
    $chat = copilotChat();
    copilot()->answer('تمام');

    copilotSay($chat, 'إيه ده؟', ['context' => ['page' => '/dashboard/orders', 'entity' => ['type' => 'unknown_thing', 'id' => 5]]]);

    $message = CopilotMessage::query()->withoutGlobalScopes()->where('role', 'user')->sole();
    $contextBlock = end(copilot()->chats[0]['messages'])['content'][0]['text'];
    expect($message->context)->toBe(['page' => '/dashboard/orders'])
        ->and($contextBlock)->toContain('/dashboard/orders')->not->toContain('unknown_thing');
});

it('sends earlier replies with what their cards showed', function () {
    copilotOwner();
    $chat = copilotChat();
    copilot()->answer(FakeAiClient::toolCall('open_page', ['target' => 'designer', 'prompt' => 'بنر']), 'دوس على الزرار.', 'تمام');
    copilotSay($chat, 'صمملي بنر');

    copilotSay($chat, 'شكرا');

    $history = collect(copilot()->chats[2]['messages'])->where('role', 'assistant')->pluck('content')->implode("\n");
    expect($history)->toContain('دوس على الزرار.')->toContain('[button shown: افتح المصمم الذكي');
});

it('needs a signed-in user and keeps chats to their own user and store', function () {
    $owner = copilotOwner();
    $chat = copilotChat();

    // Another user of the same store.
    Sanctum::actingAs(User::factory()->for($owner->tenant)->create()->fresh(['tenant']));
    $this->getJson("/api/v1/dashboard/ai/copilot/chats/{$chat}")->assertNotFound();
    $this->postJson("/api/v1/dashboard/ai/copilot/chats/{$chat}/messages", ['text' => 'x'])->assertNotFound();

    // Another store.
    copilotOwner();
    $this->getJson("/api/v1/dashboard/ai/copilot/chats/{$chat}")->assertNotFound();

    $this->app['auth']->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/ai/copilot/status')->assertUnauthorized();
});

it('never gives the model customers\' phones', function () {
    $user = copilotOwner();
    asTenant($user, fn () => Order::factory()->create(['customer_phone' => '+201012345678']));
    $chat = copilotChat();
    copilot()->answer(FakeAiClient::toolCall('store_overview'), 'تمام');

    copilotSay($chat, 'متجري عامل إيه؟');

    expect(json_encode(copilot()->chats, JSON_UNESCAPED_UNICODE))->not->toContain('1012345678');
});
