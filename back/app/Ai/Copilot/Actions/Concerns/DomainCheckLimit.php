<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions\Concerns;

use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Http\Resources\DomainResource;
use App\Models\Domain;
use Illuminate\Support\Facades\RateLimiter;

/** The domains page's own pace for DNS / SSL checks (10 a minute per store), and the domain as the page shows it. */
trait DomainCheckLimit
{
    protected static function paced(CopilotContext $ctx): void
    {
        $key = 'domain-checks:'.$ctx->tenant->id;
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw new CopilotToolError('Too many domain checks this minute; tell the merchant to try again in a minute.');
        }
        RateLimiter::hit($key, 60);
    }

    /** @return array<string, mixed> */
    protected static function domainData(Domain $domain): array
    {
        $data = DomainResource::make($domain)->resolve();

        return array_intersect_key($data, array_flip(['id', 'host', 'type', 'status', 'is_primary', 'verified_at', 'last_check_error', 'ssl_status', 'instructions']));
    }

    protected static function customDomain(array $args): Domain
    {
        $domain = isset($args['domain_id']) ? Domain::query()->find((int) $args['domain_id'])
            : (isset($args['host']) ? Domain::query()->where('host', mb_strtolower(trim((string) $args['host'])))->first() : null);
        if ($domain === null || $domain->type->value !== 'custom') {
            throw new CopilotToolError('No custom domain like that in this store (give domain_id or host).');
        }

        return $domain;
    }
}
