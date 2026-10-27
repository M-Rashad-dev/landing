<?php

declare(strict_types=1);

namespace App\Actions\Domains;

use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\SslStatus;
use App\Exceptions\ApiException;
use App\Models\Domain;
use App\Services\DomainRules;
use App\Services\DomainVerifier;
use Illuminate\Validation\ValidationException;

/** Validates, stores as pending and checks the DNS right away (phase 10, step 4). */
final class AddCustomDomain
{
    public function __construct(private readonly DomainVerifier $verifier) {}

    public function handle(string $input): Domain
    {
        $limit = (int) config('landing.limits.custom_domains');
        if (Domain::query()->where('type', DomainType::Custom)->count() >= $limit) {
            throw new ApiException(422, 'limit_reached', __('domains.limit', ['limit' => $limit]));
        }

        $host = DomainRules::normalize($input);
        $error = DomainRules::error($host);
        if ($error !== null) {
            throw ValidationException::withMessages(['host' => [$error]]);
        }

        $domain = Domain::query()->create([
            'host' => $host,
            'type' => DomainType::Custom,
            'status' => DomainStatus::Pending,
            'is_primary' => false,
            'active_host' => null,
            'ssl_status' => SslStatus::Pending,
        ]);

        return $this->verifier->verify($domain);
    }
}
