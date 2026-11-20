<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Contracts;

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ToolResult;
use LogicException;

/**
 * A special operation that is not plain records (verify a domain, change order statuses, write descriptions…).
 *
 * - approval() false: run() at once (safe checks only: nothing a merchant would want to undo).
 * - approval() true: it becomes a change the merchant approves (preview → «نفّذ»), Stage 3 adds preview/apply.
 * - reversible() false: no «تراجع» (customer messages sent, webhooks fired…), and the card says so.
 * - costly() true: AI / image work, the estimated cost is shown before it starts.
 */
abstract class CopilotAction implements CopilotCapability
{
    /** JSON Schema (object) of the action's args. */
    abstract public function schema(): array;

    abstract public function approval(): bool;

    public function reversible(): bool
    {
        return true;
    }

    public function costly(): bool
    {
        return false;
    }

    public function available(CopilotContext $ctx): bool
    {
        return true;
    }

    /** @param array<string, mixed> $args */
    public function run(array $args, CopilotContext $ctx): ToolResult
    {
        throw new LogicException(static::class.' needs the merchant\'s approval; it has no run().');
    }

    public function catalogLine(): string
    {
        $flags = array_filter([$this->approval() ? 'needs approval' : 'runs at once', $this->reversible() ? null : 'no undo', $this->costly() ? 'costs AI balance' : null]);

        return "{$this->key()}: {$this->label()} (".implode(', ', $flags)."). {$this->summary()}";
    }

    public function describe(CopilotContext $ctx): array
    {
        return [
            'kind' => 'action',
            'key' => $this->key(),
            'label' => $this->label(),
            'summary' => $this->summary(),
            'args' => $this->schema(),
            'needs_approval' => $this->approval(),
            'reversible' => $this->reversible(),
            'costly' => $this->costly(),
        ];
    }
}
