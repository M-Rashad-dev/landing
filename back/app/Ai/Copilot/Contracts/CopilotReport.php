<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Contracts;

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ReportResult;

/**
 * An aggregate question about the store (sales of a period, best sellers, low stock…). A report must use the
 * same service the dashboard page uses, so the copilot never shows a different number (§4 task 2.3).
 */
abstract class CopilotReport implements CopilotCapability
{
    /** JSON Schema (object) of the report's params. */
    abstract public function params(): array;

    /** @param array<string, mixed> $params */
    abstract public function run(array $params, CopilotContext $ctx): ReportResult;

    public function available(CopilotContext $ctx): bool
    {
        return true;
    }

    public function catalogLine(): string
    {
        return "{$this->key()}: {$this->label()}. {$this->summary()}";
    }

    public function describe(CopilotContext $ctx): array
    {
        return ['kind' => 'report', 'key' => $this->key(), 'label' => $this->label(), 'summary' => $this->summary(), 'params' => $this->params()];
    }
}
