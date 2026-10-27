<?php

declare(strict_types=1);

namespace App\Services\Dns;

/** DNS lookups behind an interface so tests can swap in fixed answers. */
interface DnsResolver
{
    /** CNAME targets of a host, lowercase, without the trailing dot. @return list<string> */
    public function cnameTargets(string $host): array;

    /** IPv4 addresses a host resolves to (after following CNAMEs). @return list<string> */
    public function ipv4(string $host): array;
}
