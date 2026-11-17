<?php

declare(strict_types=1);

namespace App\Ai;

/** What the model answered and what it cost in tokens (cached = input tokens served from the provider's cache). */
final class AiReply
{
    public function __construct(
        public readonly string $text,
        public readonly string $model,
        public readonly int $inputTokens,
        public readonly int $outputTokens,
        public readonly int $cachedTokens = 0,
    ) {}
}
