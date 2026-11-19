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

        $body = [
            'model' => $model,
            'messages' => array_map(fn (array $m) => ['role' => $m['role'], 'content' => self::content($m['content'])], $messages),
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

        $json = $this->post('chat/completions', $body);
        $usage = (array) ($json['usage'] ?? []);

        return new AiReply(
            text: (string) ($json['choices'][0]['message']['content'] ?? ''),
            // The id asked for (prices are kept by it; a «:free» id answers with the paid model's name).
            model: $model,
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
