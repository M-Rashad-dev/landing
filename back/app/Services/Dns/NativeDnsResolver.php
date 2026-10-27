<?php

declare(strict_types=1);

namespace App\Services\Dns;

/** System resolver via dns_get_record (no external API). */
final class NativeDnsResolver implements DnsResolver
{
    public function cnameTargets(string $host): array
    {
        return array_values(array_unique(array_map(
            fn (array $record): string => rtrim(strtolower((string) $record['target']), '.'),
            array_filter($this->lookup($host, DNS_CNAME), fn (array $r): bool => ($r['type'] ?? null) === 'CNAME' && isset($r['target'])),
        )));
    }

    public function ipv4(string $host): array
    {
        return array_values(array_unique(array_map(
            fn (array $record): string => (string) $record['ip'],
            array_filter($this->lookup($host, DNS_A), fn (array $r): bool => ($r['type'] ?? null) === 'A' && isset($r['ip'])),
        )));
    }

    /** @return list<array<string, mixed>> */
    private function lookup(string $host, int $type): array
    {
        // dns_get_record warns on NXDOMAIN / timeouts; both simply mean "no record yet".
        $records = @dns_get_record($host, $type);

        return is_array($records) ? array_values($records) : [];
    }
}
