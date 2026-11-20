<?php

declare(strict_types=1);

namespace App\Ai\Copilot;

use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Models\CopilotChat;
use App\Models\CopilotMessage;
use App\Models\Tenant;
use App\Models\User;
use Closure;

/**
 * Everything a copilot tool may know while it runs: the store, the user, the chat and the pending
 * reply, where the merchant was (page context), and a place to put the cards (blocks) the merchant
 * will see under the reply. Built by the engine; tools never read the request.
 */
final class CopilotContext
{
    /** @var list<array<string, mixed>> */
    private array $blocks = [];

    /** @var (Closure(string): void)|null */
    private ?Closure $onProgress = null;

    /**
     * @param  array{page?: string, entity?: array{type: string, id: int, label?: string}, selection?: array{type: string, ids: list<int>}}  $page
     */
    public function __construct(
        public readonly Tenant $tenant,
        public readonly ?User $user,
        public readonly ?CopilotChat $chat = null,
        public readonly ?CopilotMessage $message = null,
        public readonly array $page = [],
    ) {}

    /** Whether this store has the full store (not landing pages only). */
    public function hasStore(): bool
    {
        return $this->allows(PlanFeature::Store);
    }

    public function allows(PlanFeature $feature): bool
    {
        return app(Entitlements::class)->for($this->tenant)->allows($feature);
    }

    /** @param array<string, mixed> $block */
    public function addBlock(array $block): void
    {
        $this->blocks[] = $block;
    }

    /** @return list<array<string, mixed>> */
    public function blocks(): array
    {
        return $this->blocks;
    }

    /** @param Closure(string): void $callback */
    public function onProgress(Closure $callback): void
    {
        $this->onProgress = $callback;
    }

    /** A short Arabic step text for the merchant («بجيب أرقام المبيعات…»). */
    public function progress(string $text): void
    {
        if ($this->onProgress !== null) {
            ($this->onProgress)($text);
        }
    }
}
