<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Domain;
use App\Tenancy\Tenancy;
use Illuminate\Support\Str;
use RuntimeException;

final class SubdomainGenerator
{
    private const MAX_BASE_LENGTH = 20;

    private const MAX_ATTEMPTS = 50;

    /** Build a free label like "rashad-4821" from a store name. */
    public function generate(string $storeName): string
    {
        $base = $this->base($storeName);

        for ($i = 0; $i < self::MAX_ATTEMPTS; $i++) {
            $label = $base.'-'.random_int(1000, 9999);

            if ($this->isAvailable($label)) {
                return $label;
            }
        }

        throw new RuntimeException('Could not generate a unique subdomain.');
    }

    public function base(string $storeName): string
    {
        $slug = Str::slug(Str::ascii($storeName));
        $slug = (string) preg_replace('/[^a-z0-9-]/', '', strtolower($slug));
        $slug = trim(substr($slug, 0, self::MAX_BASE_LENGTH), '-');

        return $slug === '' ? 'store' : $slug;
    }

    public function host(string $label): string
    {
        return $label.'.'.config('landing.platform_domain');
    }

    public function isReserved(string $label): bool
    {
        return in_array(strtolower($label), config('landing.reserved_subdomains'), true);
    }

    public function isValidLabel(string $label): bool
    {
        return preg_match('/^(?=.{3,30}$)[a-z0-9]+(-[a-z0-9]+)*$/', $label) === 1;
    }

    public function isAvailable(string $label, ?int $ignoreDomainId = null): bool
    {
        if ($this->isReserved($label)) {
            return false;
        }

        $host = $this->host($label);

        // Audited bypass: hosts are globally unique across tenants.
        return ! Tenancy::withoutTenant(fn () => Domain::query()
            ->where(fn ($q) => $q->where('host', $host)->orWhere('active_host', $host))
            ->when($ignoreDomainId !== null, fn ($q) => $q->where('id', '!=', $ignoreDomainId))
            ->exists());
    }
}
