<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Contracts;

use App\Ai\Copilot\CopilotContext;

/**
 * Anything the copilot can work with: a resource (records), a report or an action. Every concrete class in
 * app/Ai/Copilot/{Resources,Reports,Actions} is found by CopilotCatalog on its own: adding a platform feature to
 * the copilot is one new file (docs/plans/ai-copilot.md §3.1).
 */
interface CopilotCapability
{
    /** Unique, snake (resources, reports) or dotted (actions: «orders.change_status»). */
    public function key(): string;

    /** Arabic name for the merchant («أكواد الخصم»). */
    public function label(): string;

    /** One English line for the model's catalog. */
    public function summary(): string;

    /** Whether this store may use it now (plan features, store vs landing pages only). */
    public function available(CopilotContext $ctx): bool;

    /** The full detail the model gets from `describe`. */
    public function describe(CopilotContext $ctx): array;
}
