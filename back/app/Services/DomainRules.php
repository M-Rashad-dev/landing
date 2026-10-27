<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\DomainType;
use App\Models\Domain;
use App\Tenancy\Tenancy;

/** Custom domain normalization, rejection rules and DNS instructions (phase 10). */
final class DomainRules
{
    /** "HTTPS://Shop.Example.com:443/offer?x" → "shop.example.com"; Arabic names → punycode. */
    public static function normalize(string $input): string
    {
        $host = mb_strtolower(trim($input));
        $host = (string) preg_replace('#^[a-z][a-z0-9+.-]*://#', '', $host);
        $host = (string) preg_replace('#[/?\#\\\\].*$#s', '', $host);
        if (str_contains($host, '@')) {
            $host = substr($host, (int) strrpos($host, '@') + 1);
        }
        $host = (string) preg_replace('/:\d*$/', '', $host);
        $host = rtrim(trim($host), '.');

        if ($host !== '' && preg_match('/[^\x20-\x7e]/', $host) === 1) {
            $ascii = idn_to_ascii($host, IDNA_NONTRANSITIONAL_TO_ASCII, INTL_IDNA_VARIANT_UTS46);
            $host = $ascii === false ? $host : $ascii;
        }

        return $host;
    }

    /**
     * First reason a normalized host cannot be added by this tenant, or null.
     * Pending hosts of other tenants are allowed: the first one to verify wins.
     */
    public static function error(string $host): ?string
    {
        if ($host === '') {
            return __('domains.host_required');
        }
        if (strlen($host) > 253) {
            return __('domains.host_too_long');
        }
        if (filter_var($host, FILTER_VALIDATE_IP) !== false || preg_match('/^[\d.]+$/', $host) === 1) {
            return __('domains.host_ip');
        }
        if ($host === 'localhost' || str_ends_with($host, '.localhost')) {
            return __('domains.host_localhost');
        }
        foreach (self::platformHosts() as $platform) {
            if ($host === $platform || str_ends_with($host, '.'.$platform)) {
                return __('domains.host_platform');
            }
        }
        if (! str_contains($host, '.')) {
            return __('domains.host_needs_dot');
        }
        foreach (explode('.', $host) as $label) {
            if (strlen($label) > 63 || preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/', $label) !== 1) {
                return __('domains.host_invalid');
            }
        }
        if (preg_match('/^\d+$/', (string) substr((string) strrchr($host, '.'), 1)) === 1) {
            return __('domains.host_invalid');
        }

        if (Domain::query()->where('host', $host)->exists()) {
            return __('domains.host_already_added');
        }
        // Audited bypass: an active host belongs to exactly one tenant across the platform.
        if (Tenancy::withoutTenant(fn () => Domain::query()->where('active_host', $host)->exists())) {
            return __('domains.host_taken');
        }

        return null;
    }

    /** "www.shop.com.eg" → "shop.com.eg" (known two-part suffixes from config). */
    public static function rootDomain(string $host): string
    {
        $labels = explode('.', $host);
        $lastTwo = implode('.', array_slice($labels, -2));
        $take = count($labels) >= 3 && in_array($lastTwo, config('landing.two_part_suffixes'), true) ? 3 : 2;

        return implode('.', array_slice($labels, -$take));
    }

    public static function isRoot(string $host): bool
    {
        return self::rootDomain($host) === $host;
    }

    /**
     * The one DNS record the customer adds: A @ → SERVER_IP for a root domain,
     * CNAME {sub} → cname.{PLATFORM_DOMAIN} otherwise.
     *
     * @return array{kind: string, zone: string, record: array{type: string, name: string, value: string}, cloudflare_warning: string}|null
     */
    public static function instructions(Domain $domain): ?array
    {
        if ($domain->type !== DomainType::Custom) {
            return null;
        }

        $zone = self::rootDomain($domain->host);
        $root = $zone === $domain->host;

        return [
            'kind' => $root ? 'root' : 'subdomain',
            'zone' => $zone,
            'record' => $root
                ? ['type' => 'A', 'name' => '@', 'value' => (string) config('landing.server_ip')]
                : ['type' => 'CNAME', 'name' => substr($domain->host, 0, -strlen($zone) - 1), 'value' => (string) config('landing.cname_target')],
            'cloudflare_warning' => __('domains.cloudflare_warning'),
        ];
    }

    /** @return list<string> */
    public static function platformHosts(): array
    {
        return array_values(array_unique(array_filter([
            (string) config('landing.platform_domain'),
            (string) config('landing.app_host'),
            (string) config('landing.cname_target'),
        ])));
    }
}
