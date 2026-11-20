<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Changes;

/**
 * What a costly action produced: changes to a resource's records (before / after), so the merchant previews them and
 * applies / reverts them through the normal change pipeline.
 */
final class JobResult
{
    /**
     * @param  list<array{entity_id: int, label: string, before: array<string, mixed>, after: array<string, mixed>, status?: string, note?: string|null}>  $items
     */
    public function __construct(
        public readonly string $target,
        public readonly string $summary,
        public readonly array $items,
    ) {}
}
