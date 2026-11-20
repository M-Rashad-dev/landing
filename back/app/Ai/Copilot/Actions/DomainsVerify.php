<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Actions\Concerns\DomainCheckLimit;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ToolResult;
use App\Services\DomainVerifier;

/** Checks a custom domain's DNS now (the domains page's «تحقق»): active when it points here. */
final class DomainsVerify extends CopilotAction
{
    use DomainCheckLimit;

    public function __construct(private readonly DomainVerifier $verifier) {}

    public function key(): string
    {
        return 'domains.verify';
    }

    public function label(): string
    {
        return 'التحقق من الدومين';
    }

    public function summary(): string
    {
        return 'Check now whether a custom domain\'s DNS points to the store (status becomes active). DNS can take up to a few hours to spread.';
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => ['domain_id' => ['type' => 'integer'], 'host' => ['type' => 'string']]];
    }

    public function approval(): bool
    {
        return false;
    }

    public function run(array $args, CopilotContext $ctx): ToolResult
    {
        self::paced($ctx);

        return ToolResult::ok(['domain' => self::domainData($this->verifier->verify(self::customDomain($args)))]);
    }
}
