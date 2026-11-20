<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Contracts;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Changes\JobEstimate;
use App\Ai\Copilot\Changes\JobResult;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ToolResult;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use LogicException;

/**
 * A special operation that is not plain records (verify a domain, change order statuses, write descriptions…). Three
 * shapes, by its flags:
 *
 * - approval() false: run() at once (safe checks only: nothing a merchant would want to undo).
 * - approval() true: preview() gives the card (items before / after, side effects); after «نفّذ» the applier calls
 *   apply() per item, skipping items whose current() no longer equals their `before`.
 * - costly() true (AI / image work): estimate() gives the cost card; after «ابدأ» a job calls work(), which returns
 *   changes to a resource's records, previewed and applied like any update (so «تراجع» works too).
 *
 * reversible() false: no «تراجع» (customer messages sent, webhooks fired, an import started…), and the card says so.
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

    /** @param array<string, mixed> $args */
    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        throw new LogicException(static::class.' has no preview().');
    }

    /** The item's current values (same keys as its `before`), or null when there is nothing to compare. */
    public function current(CopilotChangeItem $item, CopilotContext $ctx): ?array
    {
        return null;
    }

    /** Applies one item's `after` (throws ValidationException / ApiException with the reason). */
    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        throw new LogicException(static::class.' has no apply().');
    }

    /**
     * The card columns of its items: key => [label, kind].
     *
     * @return array<string, array{0: string, 1: string}>
     */
    public function columns(): array
    {
        return [];
    }

    /**
     * Extra data the card shows (e.g. the import it started).
     *
     * @return array<string, mixed>|null
     */
    public function card(CopilotChangeSet $set): ?array
    {
        return null;
    }

    /** @param array<string, mixed> $args */
    public function estimate(array $args, CopilotContext $ctx): JobEstimate
    {
        throw new LogicException(static::class.' is not a costly job.');
    }

    /** The AI work, run by a job after «ابدأ» (charged as it goes). */
    public function work(CopilotChangeSet $set, CopilotContext $ctx): JobResult
    {
        throw new LogicException(static::class.' is not a costly job.');
    }

    public function catalogLine(): string
    {
        $flags = array_filter([$this->approval() ? 'needs approval' : 'runs at once', $this->reversible() ? null : 'no undo', $this->costly() ? 'costs AI balance, estimate shown first' : null]);

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
