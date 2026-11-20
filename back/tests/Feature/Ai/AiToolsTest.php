<?php

declare(strict_types=1);

use App\Ai\AiClient;
use App\Ai\FakeAiClient;
use App\Ai\OpenRouterClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['ai.openrouter.api_key' => 'sk-or-test', 'ai.openrouter.base_url' => 'https://openrouter.test/api/v1']);
});

$tools = [['type' => 'function', 'function' => ['name' => 'help_search', 'description' => 'Search', 'parameters' => ['type' => 'object', 'properties' => ['query' => ['type' => 'string']]]]]];

it('sends tools and parses the tool calls with the assistant message to send back', function () use ($tools) {
    Http::fake(['openrouter.test/*' => Http::response([
        'choices' => [[
            'finish_reason' => 'tool_calls',
            'message' => [
                'role' => 'assistant',
                'content' => null,
                'tool_calls' => [
                    ['id' => 'call_1', 'type' => 'function', 'function' => ['name' => 'help_search', 'arguments' => '{"query":"كوبون"}']],
                    ['id' => 'call_2', 'type' => 'function', 'function' => ['name' => 'help_search', 'arguments' => '{broken']],
                ],
                'reasoning_details' => [['type' => 'reasoning.encrypted', 'data' => 'abc']],
            ],
        ]],
        'usage' => ['prompt_tokens' => 80, 'completion_tokens' => 12],
    ])]);

    $reply = app(OpenRouterClient::class)->chat('anthropic/claude-sonnet-5.5', [['role' => 'user', 'content' => 'إزاي أعمل كوبون؟']], ['tools' => $tools, 'tool_choice' => 'auto']);

    expect($reply->wantsTools())->toBeTrue()
        ->and($reply->finishReason)->toBe('tool_calls')
        ->and($reply->toolCalls[0])->toBe(['id' => 'call_1', 'name' => 'help_search', 'arguments' => ['query' => 'كوبون']])
        ->and($reply->toolCalls[1]['invalid'])->toBeTrue()
        ->and($reply->assistantMessage['tool_calls'])->toHaveCount(2)
        ->and($reply->assistantMessage['reasoning_details'])->toBe([['type' => 'reasoning.encrypted', 'data' => 'abc']]);
    Http::assertSent(fn (Request $r) => $r['tools'] === $tools && $r['tool_choice'] === 'auto');
});

it('sends the assistant tool message and the tool results back unchanged', function () use ($tools) {
    Http::fake(['openrouter.test/*' => Http::response(['choices' => [['message' => ['content' => 'تمام']]]])]);
    $assistant = ['role' => 'assistant', 'content' => null, 'tool_calls' => [['id' => 'call_1', 'type' => 'function', 'function' => ['name' => 'help_search', 'arguments' => '{}']]], 'reasoning_details' => [['type' => 'reasoning.text', 'text' => 'x']]];

    $reply = app(OpenRouterClient::class)->chat('anthropic/claude-sonnet-5.5', [
        ['role' => 'user', 'content' => 'سؤال'],
        $assistant,
        ['role' => 'tool', 'tool_call_id' => 'call_1', 'content' => '{"ok":true}'],
    ], ['tools' => $tools]);

    expect($reply->text)->toBe('تمام')->and($reply->wantsTools())->toBeFalse();
    Http::assertSent(fn (Request $r) => $r['messages'][1] === $assistant
        && $r['messages'][2] === ['role' => 'tool', 'content' => '{"ok":true}', 'tool_call_id' => 'call_1']);
});

it('marks the prompt cache only for models that need marks, and only when asked', function () {
    Http::fake(['openrouter.test/*' => Http::response(['choices' => [['message' => ['content' => 'ok']]]])]);
    $messages = [
        ['role' => 'system', 'content' => 'prompt'],
        ['role' => 'user', 'content' => 'old'],
        ['role' => 'assistant', 'content' => 'answer'],
        ['role' => 'user', 'content' => [['type' => 'text', 'text' => 'context'], ['type' => 'text', 'text' => 'new']]],
    ];
    $client = app(OpenRouterClient::class);

    $client->chat('anthropic/claude-sonnet-5.5', $messages, ['cache' => true]);
    $client->chat('qwen/qwen4-max', $messages, ['cache' => true]);
    $client->chat('anthropic/claude-sonnet-5.5', $messages);

    $sent = Http::recorded()->map(fn ($pair) => $pair[0]['messages'])->values();
    $mark = ['type' => 'ephemeral'];
    expect($sent[0][0]['content'])->toBe([['type' => 'text', 'text' => 'prompt', 'cache_control' => $mark]])
        ->and($sent[0][1]['content'])->toBe('old')
        ->and($sent[0][3]['content'][1])->toBe(['type' => 'text', 'text' => 'new', 'cache_control' => $mark])
        ->and($sent[0][3]['content'][0])->toBe(['type' => 'text', 'text' => 'context'])
        ->and($sent[1][0]['content'])->toBe('prompt')
        ->and($sent[2][0]['content'])->toBe('prompt');
});

it('keeps plain calls exactly as before (no tools in the body)', function () {
    Http::fake(['openrouter.test/*' => Http::response(['choices' => [['message' => ['content' => 'ok']]]])]);

    $reply = app(OpenRouterClient::class)->chat('qwen/qwen4-max', [['role' => 'user', 'content' => 'hi']]);

    expect($reply->toolCalls)->toBe([])->and($reply->assistantMessage)->toBe([]);
    Http::assertSent(fn (Request $r) => ! isset($r['tools']) && ! isset($r['tool_choice'])
        && $r['messages'] === [['role' => 'user', 'content' => 'hi']]);
});

it('scripts tool calls in the fake', function () {
    /** @var FakeAiClient $fake */
    $fake = app(AiClient::class);
    $fake->answer(FakeAiClient::toolCalls(['help_search', ['query' => 'دومين']], ['store_overview', []]), 'خلصت');

    $first = $fake->chat('m', [['role' => 'user', 'content' => 'x']], ['tools' => []]);
    $second = $fake->chat('m', [['role' => 'user', 'content' => 'x']]);

    expect(array_column($first->toolCalls, 'name'))->toBe(['help_search', 'store_overview'])
        ->and($first->toolCalls[0]['arguments'])->toBe(['query' => 'دومين'])
        ->and($first->assistantMessage['tool_calls'][0]['id'])->toBe($first->toolCalls[0]['id'])
        ->and($first->model)->toBe('m')
        ->and($second->text)->toBe('خلصت');
});
