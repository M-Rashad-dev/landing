<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Actions\Domains\ManageDomain;
use App\Ai\Copilot\Actions\Concerns\DomainCheckLimit;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ToolResult;

/** Checks a domain's SSL certificate now (the domains page's «افحص الشهادة»). */
final class DomainsCheckSsl extends CopilotAction
{
    use DomainCheckLimit;

    public function __construct(private readonly ManageDomain $manage) {}

    public function key(): string
    {
        return 'domains.check_ssl';
    }

    public function label(): string
    {
        return 'فحص شهادة الأمان (SSL)';
    }

    public function summary(): string
    {
        return 'Check now whether an active custom domain has its HTTPS certificate.';
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

        return ToolResult::ok(['domain' => self::domainData($this->manage->checkSsl(self::customDomain($args)))]);
    }
}
