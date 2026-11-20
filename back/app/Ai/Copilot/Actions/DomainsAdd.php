<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Actions\Domains\AddCustomDomain;
use App\Ai\Copilot\Actions\Concerns\DomainCheckLimit;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ToolResult;

/**
 * Adds a custom domain the way the domains page does (pending until its DNS points here; the store keeps its current
 * address meanwhile) and gives the DNS records to set. Runs at once: a pending domain changes nothing for customers.
 */
final class DomainsAdd extends CopilotAction
{
    use DomainCheckLimit;

    public function __construct(private readonly AddCustomDomain $add) {}

    public function key(): string
    {
        return 'domains.add';
    }

    public function label(): string
    {
        return 'ربط دومين';
    }

    public function summary(): string
    {
        return 'Add a custom domain (it stays pending until its DNS is set; nothing changes for customers) and get the DNS records to explain step by step. Making a domain primary or deleting it is not done here: open the domains page.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => ['host' => ['type' => 'string', 'description' => 'e.g. "mystore.com" or "shop.mystore.com".']], 'required' => ['host']];
    }

    public function approval(): bool
    {
        return false;
    }

    public function run(array $args, CopilotContext $ctx): ToolResult
    {
        $domain = $this->add->handle(mb_substr(trim((string) ($args['host'] ?? '')), 0, 300));
        $ctx->addBlock(['type' => 'handoff', 'target' => 'page', 'label' => (string) __('ai.copilot.open_domains'), 'href' => '/dashboard/settings/domains']);

        return ToolResult::ok(['domain' => self::domainData($domain), 'note' => 'Explain the DNS records in simple Arabic steps (where to add them at the registrar). After the merchant sets them, use domains.verify.']);
    }
}
