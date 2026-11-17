<?php

declare(strict_types=1);

namespace App\Ai;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Qwen on Alibaba Cloud Model Studio, through its OpenAI-compatible API (the workspace's own
 * address and key, config/ai.php). One retry on a connection error or a server error; anything
 * else is an AiError for App\Ai\Ai to count.
 */
final class QwenClient implements AiClient
{
    public function configured(): bool
    {
        return filled(config('ai.qwen.api_key')) && filled(config('ai.qwen.base_url'));
    }

    public function chat(string $model, array $messages, array $options = []): AiReply
    {
        $body = [
            'model' => $model,
            'messages' => array_map(fn (array $m) => ['role' => $m['role'], 'content' => self::content($m['content'])], $messages),
            // Deep thinking multiplies the bill: only for the tasks that ask for it.
            'enable_thinking' => (bool) ($options['thinking'] ?? false),
        ];
        if (isset($options['max_tokens'])) {
            $body['max_tokens'] = $options['max_tokens'];
        }
        if (isset($options['temperature'])) {
            $body['temperature'] = $options['temperature'];
        }
        if ($options['json'] ?? false) {
            $body['response_format'] = ['type' => 'json_object'];
        }

        $json = $this->post('chat/completions', $body);
        $usage = (array) ($json['usage'] ?? []);

        return new AiReply(
            text: (string) ($json['choices'][0]['message']['content'] ?? ''),
            model: (string) ($json['model'] ?? $model),
            inputTokens: (int) ($usage['prompt_tokens'] ?? 0),
            outputTokens: (int) ($usage['completion_tokens'] ?? 0),
            cachedTokens: (int) ($usage['prompt_tokens_details']['cached_tokens'] ?? 0),
        );
    }

    public function embed(string $model, array $texts): AiEmbeddings
    {
        $json = $this->post('embeddings', ['model' => $model, 'input' => array_values($texts), 'encoding_format' => 'float']);
        $rows = (array) ($json['data'] ?? []);
        usort($rows, fn ($a, $b) => ((int) ($a['index'] ?? 0)) <=> ((int) ($b['index'] ?? 0)));

        return new AiEmbeddings(
            vectors: array_map(fn (array $row) => array_map('floatval', (array) $row['embedding']), $rows),
            model: $model,
            inputTokens: (int) ($json['usage']['prompt_tokens'] ?? $json['usage']['total_tokens'] ?? 0),
        );
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
            throw new AiError('Qwen is not configured');
        }

        try {
            $response = $this->http()->post($path, $body);
        } catch (ConnectionException $e) {
            throw new AiError('Qwen unreachable: '.$e->getMessage());
        }

        if (! $response->successful()) {
            throw new AiError(self::reason($response), $response->status());
        }

        return (array) $response->json();
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('ai.qwen.base_url'), '/').'/')
            ->withToken((string) config('ai.qwen.api_key'))
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('ai.qwen.timeout', 60))
            ->retry(2, 800, fn ($e) => $e instanceof ConnectionException || ($e->response?->serverError() ?? false), throw: false);
    }

    private static function reason(Response $response): string
    {
        $error = (array) ($response->json('error') ?? []);
        $code = (string) ($error['code'] ?? $response->json('code') ?? '');
        $message = (string) ($error['message'] ?? $response->json('message') ?? '');

        return trim("Qwen {$response->status()} {$code} {$message}");
    }
}
