<?php

declare(strict_types=1);

namespace App\Ai;

/** One vector per text, and the input tokens it cost. */
final class AiEmbeddings
{
    /** @param list<list<float>> $vectors */
    public function __construct(
        public readonly array $vectors,
        public readonly string $model,
        public readonly int $inputTokens,
    ) {}
}
