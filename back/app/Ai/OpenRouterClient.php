<?php

declare(strict_types=1);

namespace App\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * OpenRouter (owner-approved provider, 2026-11-18): one account and key for every model (Qwen,
 * Google, NVIDIA…), through its OpenAI-compatible API (config/ai.php). Model ids carry their
 * vendor («qwen/qwen4-max»); «:free» ids cost nothing. Reasoning (thinking tokens) is off unless a
 * task asks for it. One retry on a connection or server error; anything else is an AiError for
 * App\Ai\Ai to count.
 */
final class OpenRouterClient implements AiClient
{
    /** Thinking tokens allowed when a task doesn't ask for deep thinking. */
    public const LIGHT_REASONING = 512;

    public function configured(): bool
    {
        return filled(config('ai.openrouter.api_key')) && filled(config('ai.openrouter.base_url'));
    }

    public function chat(string $model, array $messages, array $options = []): AiReply
    {
        $effort = isset($options['effort']) && is_string($options['effort']) ? trim($options['effort']) : '';
        $reasoning = match (true) {
            $effort === 'none' => ['effort' => 'none'],
            $effort !== '' => ['effort' => $effort, 'enabled' => true],
            (bool) ($options['thinking'] ?? false) => ['enabled' => true],
            default => ['max_tokens' => self::LIGHT_REASONING],
        };

        $wire = array_map(fn (array $m) => self::message($m), $messages);
        if (($options['cache'] ?? false) && self::cachesWithMarks($model)) {
            $wire = self::markCache($wire);
        }

        $body = [
            'model' => $model,
            'messages' => $wire,
            // Thinking is billed, so it uses an explicit effort level, full adaptive thinking, or a small
            // token budget. Never «enabled: false»: qwen4-max on OpenRouter then answers broken JSON.
            'reasoning' => $reasoning,
        ];
        if (isset($options['max_tokens'])) {
            $body['max_tokens'] = $options['max_tokens'];
        }
        if (isset($options['temperature']) && ! in_array($model, (array) config('ai.without_temperature', []), true)) {
            $body['temperature'] = $options['temperature'];
        }
        if ($options['json'] ?? false) {
            $body['response_format'] = ['type' => 'json_object'];
        }
        if (! empty($options['tools'])) {
            $body['tools'] = array_values($options['tools']);
            if (isset($options['tool_choice'])) {
                $body['tool_choice'] = $options['tool_choice'];
            }
        }

        $json = $this->post('chat/completions', $body);
        $usage = (array) ($json['usage'] ?? []);
        $message = (array) ($json['choices'][0]['message'] ?? []);
        [$toolCalls, $assistant] = self::toolCalls($message);

        return new AiReply(
            text: (string) ($message['content'] ?? ''),
            // The id asked for (prices are kept by it; a «:free» id answers with the paid model's name).
            model: $model,
            inputTokens: (int) ($usage['prompt_tokens'] ?? 0),
            outputTokens: (int) ($usage['completion_tokens'] ?? 0),
            cachedTokens: (int) ($usage['prompt_tokens_details']['cached_tokens'] ?? 0),
            toolCalls: $toolCalls,
            assistantMessage: $assistant,
            finishReason: isset($json['choices'][0]['finish_reason']) ? (string) $json['choices'][0]['finish_reason'] : null,
        );
    }

    /**
     * One message in the wire shape: content converted, and the tool fields (an assistant's tool calls
     * and reasoning blocks, a tool result's call id) passed through unchanged.
     *
     * @param  array<string, mixed>  $m
     * @return array<string, mixed>
     */
    private static function message(array $m): array
    {
        $content = $m['content'] ?? null;
        $out = ['role' => $m['role'], 'content' => $content === null ? null : self::content($content)];
        foreach (['tool_calls', 'reasoning_details', 'tool_call_id'] as $key) {
            if (isset($m[$key])) {
                $out[$key] = $m[$key];
            }
        }

        return $out;
    }

    /**
     * The tool calls of an answer (arguments decoded; broken JSON is flagged so the caller can tell the
     * model) and the assistant message to send back next round.
     *
     * @param  array<string, mixed>  $message
     * @return array{0: list<array{id: string, name: string, arguments: array<string, mixed>, invalid?: bool}>, 1: array<string, mixed>}
     */
    private static function toolCalls(array $message): array
    {
        $calls = [];
        foreach ((array) ($message['tool_calls'] ?? []) as $call) {
            if (! is_array($call) || ! isset($call['function']['name'])) {
                continue;
            }
            $raw = $call['function']['arguments'] ?? '{}';
            $args = is_array($raw) ? $raw : json_decode((string) $raw, true);
            $calls[] = ['id' => (string) ($call['id'] ?? ''), 'name' => (string) $call['function']['name'], 'arguments' => is_array($args) ? $args : []]
                + (is_array($args) ? [] : ['invalid' => true]);
        }
        if ($calls === []) {
            return [[], []];
        }

        $assistant = ['role' => 'assistant', 'content' => $message['content'] ?? null, 'tool_calls' => $message['tool_calls']];
        if (isset($message['reasoning_details'])) {
            $assistant['reasoning_details'] = $message['reasoning_details'];
        }

        return [$calls, $assistant];
    }

    /** Models whose prompt cache needs explicit marks (config ai.cache_control_prefixes). */
    private static function cachesWithMarks(string $model): bool
    {
        foreach ((array) config('ai.cache_control_prefixes', []) as $prefix) {
            if (is_string($prefix) && $prefix !== '' && str_starts_with($model, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Two cache marks: the end of the system message (the fixed prompt, and the tools before it) and the
     * last user message (the history), so later tool rounds of the same turn read it from the cache.
     *
     * @param  list<array<string, mixed>>  $wire
     * @return list<array<string, mixed>>
     */
    private static function markCache(array $wire): array
    {
        $lastUser = null;
        foreach ($wire as $i => $m) {
            if ($m['role'] === 'user') {
                $lastUser = $i;
            }
        }
        foreach ($wire as $i => $m) {
            if (($m['role'] === 'system' && $i === 0) || $i === $lastUser) {
                $wire[$i]['content'] = self::marked($m['content']);
            }
        }

        return $wire;
    }

    /**
     * @param  string|list<array<string, mixed>>|null  $content
     * @return list<array<string, mixed>>|string|null
     */
    private static function marked(string|array|null $content): string|array|null
    {
        if ($content === null || $content === '' || $content === []) {
            return $content;
        }
        $parts = is_string($content) ? [['type' => 'text', 'text' => $content]] : $content;
        for ($i = count($parts) - 1; $i >= 0; $i--) {
            if (($parts[$i]['type'] ?? '') === 'text') {
                $parts[$i]['cache_control'] = ['type' => 'ephemeral'];
                break;
            }
        }

        return $parts;
    }

    public function embed(string $model, array $texts): AiEmbeddings
    {
        $json = $this->post('embeddings', ['model' => $model, 'input' => array_values($texts), 'encoding_format' => 'float']);
        $rows = (array) ($json['data'] ?? []);
        usort($rows, fn ($a, $b) => ((int) ($a['index'] ?? 0)) <=> ((int) ($b['index'] ?? 0)));
        if (count($rows) !== count($texts)) {
            throw new AiError('OpenRouter embeddings: '.count($rows).' vectors for '.count($texts).' texts');
        }

        return new AiEmbeddings(
            vectors: array_map(fn (array $row) => array_map('floatval', (array) $row['embedding']), $rows),
            model: $model,
            inputTokens: (int) ($json['usage']['prompt_tokens'] ?? $json['usage']['total_tokens'] ?? 0),
        );
    }

    public function generateImage(string $model, string $prompt, string $aspect = '1:1'): AiImage
    {
        return $this->image($model, $prompt, $aspect);
    }

    public function editImage(string $model, string $imageDataUrl, string $instruction, string $aspect = '1:1'): AiImage
    {
        return $this->image($model, [
            ['type' => 'text', 'text' => $instruction],
            ['type' => 'image', 'url' => $imageDataUrl],
        ], $aspect);
    }

    /**
     * Image models answer through chat completions with an image in the message (a base64 data
     * URL). Image-only models (config ai.image_only_models) take modalities [image], the others
     * [image, text].
     *
     * @param  string|list<array<string, string>>  $content
     */
    private function image(string $model, string|array $content, string $aspect): AiImage
    {
        $imageOnly = in_array($model, (array) config('ai.image_only_models'), true);
        $json = $this->post('chat/completions', [
            'model' => $model,
            'modalities' => $imageOnly ? ['image'] : ['image', 'text'],
            'messages' => [['role' => 'user', 'content' => self::content($content)]],
            'image_config' => ['aspect_ratio' => $aspect],
        ]);

        $url = (string) ($json['choices'][0]['message']['images'][0]['image_url']['url'] ?? '');
        if (! preg_match('#^data:(image/[a-z+.-]+);base64,(.+)$#s', $url, $m)) {
            throw new AiError('OpenRouter: no image in the answer');
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false || $bytes === '') {
            throw new AiError('OpenRouter: the image could not be read');
        }
        $cost = $json['usage']['cost'] ?? null;

        return new AiImage($bytes, $m[1], $model, is_numeric($cost) ? (float) $cost : null);
    }

    /**
     * A text stays a text; parts become the OpenAI shape (images as image_url).
     *
     * @param  string|list<array<string, string>>  $content
     * @return string|list<array<string, mixed>>
     */
    private static function content(string|array $content): string|array
    {
        if (is_string($content)) {
            return $content;
        }

        return array_map(fn (array $part) => ($part['type'] ?? 'text') === 'image'
            ? ['type' => 'image_url', 'image_url' => ['url' => (string) $part['url']]]
            : ['type' => 'text', 'text' => (string) ($part['text'] ?? '')], $content);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function post(string $path, array $body): array
    {
        if (! $this->configured()) {
            throw new AiError('OpenRouter is not configured');
        }

        try {
            $response = $this->http()->post($path, $body);
        } catch (ConnectionException $e) {
            throw new AiError('OpenRouter unreachable: '.$e->getMessage());
        }

        // OpenRouter may answer 200 with an error body (a provider failed mid-way).
        if (! $response->successful() || is_array($response->json('error'))) {
            throw new AiError(self::reason($response), $response->status());
        }

        return (array) $response->json();
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('ai.openrouter.base_url'), '/').'/')
            ->withToken((string) config('ai.openrouter.api_key'))
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('ai.openrouter.timeout', 180))
            ->retry(2, 800, fn ($e) => $e instanceof ConnectionException || ($e->response?->serverError() ?? false), throw: false);
    }

    private static function reason(Response $response): string
    {
        $error = (array) ($response->json('error') ?? []);
        $code = (string) ($error['code'] ?? '');
        $message = (string) ($error['message'] ?? $response->json('message') ?? '');

        return trim("OpenRouter {$response->status()} {$code} {$message}");
    }
}
