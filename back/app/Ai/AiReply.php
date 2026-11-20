<?php

declare(strict_types=1);

namespace App\Ai;

/**
 * What the model answered and what it cost in tokens (cached = input tokens served from the provider's cache).
 * With tools, it may ask for tool calls instead of (or besides) text: `toolCalls` are parsed for the caller, and
 * `assistantMessage` is the raw assistant message to send back unchanged in the next round (it keeps the
 * provider's reasoning blocks, which some models require across tool calls).
 */
final class AiReply
{
    /**
     * @param  list<array{id: string, name: string, arguments: array<string, mixed>, invalid?: bool}>  $toolCalls
     * @param  array<string, mixed>  $assistantMessage
     */
    public function __construct(
        public readonly string $text,
        public readonly string $model,
        public readonly int $inputTokens,
        public readonly int $outputTokens,
        public readonly int $cachedTokens = 0,
        public readonly array $toolCalls = [],
        public readonly array $assistantMessage = [],
        public readonly ?string $finishReason = null,
    ) {}

    public function wantsTools(): bool
    {
        return $this->toolCalls !== [];
    }
}
