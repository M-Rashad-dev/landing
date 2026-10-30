<?php

declare(strict_types=1);

namespace App\Services\Webhooks;

use App\Enums\WebhookKind;
use App\Services\Dns\DnsResolver;

/**
 * Merchant-given URLs we POST to. Only https on port 443, and the host must resolve to public
 * addresses only (no localhost, private, link-local or reserved ranges), checked right before
 * each delivery; the request is then pinned to the checked address (no DNS rebinding).
 */
final class OutboundUrl
{
    public const SHEETS_PATTERN = '#^https://script\.google\.com/macros/s/[A-Za-z0-9_-]{20,}/exec$#';

    public function __construct(private readonly DnsResolver $dns) {}

    /** Shape check when saving: null when fine, otherwise the translation key of the problem. */
    public function problem(string $url, WebhookKind $kind): ?string
    {
        if ($kind === WebhookKind::GoogleSheets) {
            return preg_match(self::SHEETS_PATTERN, $url) === 1 ? null : 'integrations.sheets_url';
        }
        $parts = parse_url($url);
        if (! is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            return 'integrations.https_only';
        }
        if (isset($parts['port']) && (int) $parts['port'] !== 443) {
            return 'integrations.https_only';
        }
        $host = strtolower($parts['host']);
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
            return 'integrations.private_host';
        }
        if (filter_var($host, FILTER_VALIDATE_IP) !== false && ! self::isPublicIp($host)) {
            return 'integrations.private_host';
        }

        return null;
    }

    /**
     * Public IPv4 to connect to, or null when the host does not resolve or any address is private.
     */
    public function resolve(string $url): ?string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        if ($host === '') {
            return null;
        }
        $ips = filter_var($host, FILTER_VALIDATE_IP) !== false ? [$host] : $this->dns->ipv4($host);
        if ($ips === []) {
            return null;
        }
        foreach ($ips as $ip) {
            if (! self::isPublicIp($ip)) {
                return null;
            }
        }

        return $ips[0];
    }

    public static function isPublicIp(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false
            && ! str_starts_with($ip, '100.64.') // carrier-grade NAT
            && ! str_starts_with($ip, '0.');
    }
}
