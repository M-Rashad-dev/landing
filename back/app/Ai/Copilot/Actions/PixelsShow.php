<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ToolResult;
use App\Support\Pixels;

/**
 * The store's tracking pixels (Meta, TikTok, Google, Snapchat… for the store and the landing pages) as the pixels page
 * shows them. Changing them is done on that page (a button is given).
 */
final class PixelsShow extends CopilotAction
{
    public function __construct(private readonly Pixels $pixels) {}

    public function key(): string
    {
        return 'pixels.show';
    }

    public function label(): string
    {
        return 'البيكسلات';
    }

    public function summary(): string
    {
        return 'Read the store\'s tracking pixels (store and landing pages). To change them, open the pixels page.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => (object) []];
    }

    public function approval(): bool
    {
        return false;
    }

    public function run(array $args, CopilotContext $ctx): ToolResult
    {
        $ctx->addBlock(['type' => 'handoff', 'target' => 'page', 'label' => (string) __('ai.copilot.open_pixels'), 'href' => '/dashboard/settings/pixels']);

        return ToolResult::ok(['pixels' => $this->pixels->settings($ctx->tenant), 'note' => 'Pixel ids are public on the pages; changes are made on the pixels page (button shown).']);
    }
}
