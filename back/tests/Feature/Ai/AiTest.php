<?php

declare(strict_types=1);

use App\Ai\Ai;
use App\Ai\AiClient;
use App\Ai\AiCost;
use App\Ai\AiError;
use App\Ai\AiUnavailable;
use App\Ai\FakeAiClient;
use App\Ai\OpenRouterClient;
use App\Billing\PlatformSettings;
use App\Models\AiUsage;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

function fakeAi(): FakeAiClient
{
    return app(AiClient::class);
}

function aiOn(array $more = []): void
{
    app(PlatformSettings::class)->save(['ai_features' => ['support' => true]] + $more);
}

function askSupport(?int $tenantId = null)
{
    return app(Ai::class)->chat('support', 'support', [['role' => 'user', 'content' => 'إزاي أضيف منتج؟']], [], $tenantId);
}

function blockedBy(callable $call): ?string
{
    try {
        $call();
    } catch (AiUnavailable $e) {
        return $e->reason;
    }

    return null;
}

it('asks the model of the task and records the call with its cost', function () {
    aiOn();
    $tenant = Tenant::factory()->create();
    fakeAi()->answer('روح المنتجات ← منتج جديد.');

    $reply = askSupport($tenant->id);

    expect($reply->text)->toBe('روح المنتجات ← منتج جديد.')
        ->and(fakeAi()->chats[0]['model'])->toBe('qwen/qwen4-max');
    $usage = AiUsage::query()->sole();
    // 1000 in (400 from the cache), 200 out at qwen4-max prices: (600×1.425 + 400×0.075 + 200×4.275) / 1M.
    expect($usage->tenant_id)->toBe($tenant->id)
        ->and($usage->feature)->toBe('support')
        ->and([$usage->input_tokens, $usage->cached_tokens, $usage->output_tokens])->toBe([1000, 400, 200])
        ->and((float) $usage->cost_usd)->toBe(0.00174)
        ->and($usage->ok)->toBeTrue();
});

it('asks nothing when the feature is off, the keys are missing or today is spent', function () {
    expect(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::OFF);

    aiOn(['ai_daily_cap_usd' => 0.002]);
    app()->instance(AiClient::class, new FakeAiClient(configured: false));
    app()->forgetInstance(Ai::class);
    expect(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::NOT_CONFIGURED);

    app()->instance(AiClient::class, new FakeAiClient);
    app()->forgetInstance(Ai::class);
    askSupport();
    askSupport();
    expect(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::DAILY_LIMIT)
        ->and(app(AiClient::class)->chats)->toHaveCount(2)
        ->and(app(Ai::class)->available('support'))->toBeFalse();
});

it('pauses after failures in a row, tells the owner, and a success resets the count', function () {
    aiOn();
    $admin = User::factory()->superAdmin()->create();
    fakeAi()->answer(new AiError('Qwen 500'), 'تمام', new AiError('Qwen 500'), new AiError('Qwen 500'), new AiError('Qwen 500'));

    expect(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::FAILED);
    askSupport(); // a success in between: the count starts again
    expect(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::FAILED)
        ->and(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::FAILED)
        ->and(app(Ai::class)->pausedUntil())->toBeNull()
        ->and(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::FAILED)
        ->and(app(Ai::class)->pausedUntil())->not->toBeNull()
        ->and(blockedBy(fn () => askSupport()))->toBe(AiUnavailable::PAUSED);

    expect(AiUsage::query()->where('ok', false)->count())->toBe(4)
        ->and(AiUsage::query()->where('ok', false)->value('error'))->toBe('Qwen 500')
        ->and(UserNotification::query()->where('user_id', $admin->id)->where('event', 'ai_paused')->count())->toBe(1);

    $this->travel(6)->minutes();
    expect(app(Ai::class)->available('support'))->toBeTrue();
});

it('talks to OpenRouter in its OpenAI-compatible shape, with images and without reasoning', function () {
    config(['ai.openrouter.api_key' => 'sk-or-test', 'ai.openrouter.base_url' => 'https://openrouter.test/api/v1']);
    Http::fake(['openrouter.test/*' => Http::response([
        'model' => 'google/gemma-4-31b-it',
        'choices' => [['message' => ['content' => 'أهلًا']]],
        'usage' => ['prompt_tokens' => 50, 'completion_tokens' => 5, 'prompt_tokens_details' => ['cached_tokens' => 20]],
    ])]);

    $reply = app(OpenRouterClient::class)->chat('google/gemma-4-31b-it:free', [
        ['role' => 'system', 'content' => 'انت مساعد مكسب.'],
        ['role' => 'user', 'content' => [['type' => 'text', 'text' => 'شوف الصورة'], ['type' => 'image', 'url' => 'https://cdn.example.com/a.jpg']]],
    ], ['max_tokens' => 300, 'json' => true]);

    // The id asked for is kept (a «:free» id answers with the paid model's name).
    expect([$reply->text, $reply->model, $reply->inputTokens, $reply->outputTokens, $reply->cachedTokens])->toBe(['أهلًا', 'google/gemma-4-31b-it:free', 50, 5, 20]);
    Http::assertSent(fn (Request $r) => $r->url() === 'https://openrouter.test/api/v1/chat/completions'
        && $r->hasHeader('Authorization', 'Bearer sk-or-test')
        && $r['reasoning'] === ['enabled' => false]
        && $r['max_tokens'] === 300
        && $r['response_format'] === ['type' => 'json_object']
        && $r['messages'][1]['content'][1] === ['type' => 'image_url', 'image_url' => ['url' => 'https://cdn.example.com/a.jpg']]);
});

it('embeds through OpenRouter in order', function () {
    config(['ai.openrouter.api_key' => 'sk-or-test', 'ai.openrouter.base_url' => 'https://openrouter.test/api/v1']);
    Http::fake(['openrouter.test/*' => Http::response([
        'data' => [['index' => 1, 'embedding' => [0.3, 0.4]], ['index' => 0, 'embedding' => [0.1, 0.2]]],
        'usage' => ['prompt_tokens' => 12],
    ])]);

    $result = app(OpenRouterClient::class)->embed('qwen/qwen3-embedding-8b', ['أ', 'ب']);

    expect($result->vectors)->toBe([[0.1, 0.2], [0.3, 0.4]])->and($result->inputTokens)->toBe(12);
});

it('turns a refusal from OpenRouter into an AiError, even inside a 200, and refuses to call without a key', function () {
    config(['ai.openrouter.api_key' => 'sk-or-test', 'ai.openrouter.base_url' => 'https://openrouter.test/api/v1']);
    Http::fake(['*' => Http::sequence()
        ->push(['error' => ['code' => 402, 'message' => 'Insufficient credits']], 402)
        ->push(['error' => ['code' => 502, 'message' => 'Provider returned error']], 200)]);

    expect(fn () => app(OpenRouterClient::class)->chat('qwen/qwen4-max', [['role' => 'user', 'content' => 'hi']]))
        ->toThrow(AiError::class, 'OpenRouter 402 402 Insufficient credits')
        ->and(fn () => app(OpenRouterClient::class)->chat('qwen/qwen4-max', [['role' => 'user', 'content' => 'hi']]))
        ->toThrow(AiError::class, 'Provider returned error');

    config(['ai.openrouter.api_key' => null]);
    expect(app(OpenRouterClient::class)->configured())->toBeFalse()
        ->and(fn () => app(OpenRouterClient::class)->embed('qwen/qwen3-embedding-8b', ['x']))->toThrow(AiError::class);
});

it('counts «:free» models as priced at nothing', function () {
    expect(AiCost::priced('google/gemma-4-31b-it:free'))->toBeTrue()
        ->and(AiCost::usd('google/gemma-4-31b-it:free', 5000, 5000))->toBe(0.0)
        ->and(AiCost::priced('someone/unknown-model'))->toBeFalse();
});

it('keeps the AI page to super admins', function () {
    $this->getJson('/api/v1/admin/ai')->assertUnauthorized();
    Sanctum::actingAs(createOwner());
    $this->getJson('/api/v1/admin/ai')->assertForbidden();
    $this->putJson('/api/v1/admin/ai/settings', [])->assertForbidden();
});

it('shows the settings, the connection and what the AI cost', function () {
    aiOn();
    $store = Tenant::factory()->create(['name' => 'متجر سما']);
    fakeAi()->answer('أ', new AiError('Qwen 429 Throttling'));
    askSupport($store->id);
    blockedBy(fn () => askSupport($store->id));
    Sanctum::actingAs(User::factory()->superAdmin()->create());

    $data = $this->getJson('/api/v1/admin/ai')->assertOk()->json('data');

    expect($data['settings'])->toEqual(['features' => ['support' => true], 'daily_cap_usd' => 20, 'usd_rate' => null, 'margin_percent' => 10, 'support_daily_messages' => 30, 'topup_packages' => [100, 250, 500, 1000], 'topup_min' => 50, 'topup_offers' => [], 'welcome_credit' => 10, 'low_balance' => 10])
        ->and($data['status']['configured'])->toBeTrue()
        ->and($data['status']['limit_reached'])->toBeFalse()
        ->and($data['models'])->toBe([['model' => 'qwen/qwen4-max', 'priced' => true], ['model' => 'qwen/qwen3-embedding-8b', 'priced' => true]])
        ->and($data['usage']['today'])->toBe(['calls' => 2, 'usd' => 0.0017, 'failed' => 1])
        ->and($data['usage']['top_stores'][0])->toMatchArray(['name' => 'متجر سما', 'calls' => 2])
        ->and($data['usage']['failures'][0]['error'])->toBe('Qwen 429 Throttling');
});

it('saves the AI settings and refuses wrong ones', function () {
    Sanctum::actingAs(User::factory()->superAdmin()->create());
    $good = ['features' => ['support' => true], 'daily_cap_usd' => 5, 'usd_rate' => 50.5, 'margin_percent' => 15, 'support_daily_messages' => 40, 'topup_packages' => [100, 250, 500, 1000], 'topup_min' => 50, 'topup_offers' => [], 'welcome_credit' => 10, 'low_balance' => 10];

    $this->putJson('/api/v1/admin/ai/settings', $good)->assertOk()
        ->assertJsonPath('data.settings.features.support', true)
        ->assertJsonPath('data.settings.daily_cap_usd', 5)
        ->assertJsonPath('data.settings.usd_rate', 50.5)
        ->assertJsonPath('data.settings.support_daily_messages', 40);
    expect(app(Ai::class)->available('support'))->toBeTrue();

    $this->putJson('/api/v1/admin/ai/settings', ['features' => ['support' => 'maybe'], 'daily_cap_usd' => -1, 'usd_rate' => 0, 'margin_percent' => 900, 'support_daily_messages' => 1.5])
        ->assertStatus(422)->assertJsonValidationErrors(['features.support', 'daily_cap_usd', 'usd_rate', 'margin_percent', 'support_daily_messages']);
});
