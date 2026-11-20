<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

/** A costly action before it starts: what it will do, for how many records, and the most it may cost (USD). */
final class JobEstimate
{
    /** @param array<string, mixed> $spec what work() needs (record ids, options) */
    public function __construct(
        public readonly string $summary,
        public readonly int $count,
        public readonly float $usd,
        public readonly array $spec,
    ) {}
}
