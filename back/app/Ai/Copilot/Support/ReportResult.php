<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

/**
 * A report's answer: `summary` (numbers and short facts) goes to the model; `table` (headers + rows) is what the
 * merchant sees and what an export writes. The model never gets more than the summary and a few rows.
 */
final class ReportResult
{
    /**
     * @param  array<string, mixed>  $summary
     * @param  list<array{key: string, label: string, kind?: string}>  $columns
     * @param  list<array<string, mixed>>  $rows
     */
    public function __construct(
        public readonly array $summary,
        public readonly string $title = '',
        public readonly array $columns = [],
        public readonly array $rows = [],
    ) {}

    public function hasTable(): bool
    {
        return $this->columns !== [];
    }
}
