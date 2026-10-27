<?php

declare(strict_types=1);

namespace App\Actions\Domains;

use App\Enums\DomainType;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Domain;
use App\Services\SubdomainGenerator;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Renames the free subdomain; the old name is released at once (phase 10, step 9). */
final class ChangeSubdomain
{
    public function __construct(private readonly SubdomainGenerator $subdomains) {}

    /** Null when the label can be used by this tenant, otherwise an Arabic reason. */
    public function labelError(string $label, ?int $ownDomainId): ?string
    {
        return match (true) {
            ! $this->subdomains->isValidLabel($label) => __('domains.label_invalid'),
            $this->subdomains->isReserved($label) => __('domains.label_reserved'),
            ! $this->subdomains->isAvailable($label, $ownDomainId) => __('domains.label_taken'),
            default => null,
        };
    }

    public function handle(string $label): Domain
    {
        $label = strtolower(trim($label));
        $domain = Domain::query()->where('type', DomainType::Subdomain)->firstOrFail();
        $oldHost = $domain->host;
        $newHost = $this->subdomains->host($label);

        if ($newHost === $oldHost) {
            return $domain;
        }

        $error = $this->labelError($label, $domain->id);
        if ($error !== null) {
            throw ValidationException::withMessages(['label' => [$error]]);
        }

        try {
            DB::transaction(fn () => $domain->forceFill(['host' => $newHost, 'active_host' => $newHost])->save());
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['label' => [__('domains.label_taken')]]);
        }

        RevalidateTenantHosts::dispatch($domain->tenant_id, [$oldHost]);

        return $domain;
    }
}
