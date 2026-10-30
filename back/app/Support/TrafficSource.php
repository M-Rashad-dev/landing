<?php

declare(strict_types=1);

namespace App\Support;

/** Where a visit came from: utm_source first, then the referrer's host. */
final class TrafficSource
{
    public const SOURCES = ['facebook', 'instagram', 'tiktok', 'google', 'snapchat', 'youtube', 'whatsapp', 'x', 'direct', 'other'];

    private const MATCHES = [
        'facebook' => ['facebook', 'fb', 'fb.com', 'messenger', 'meta'],
        'instagram' => ['instagram', 'ig'],
        'tiktok' => ['tiktok'],
        'google' => ['google', 'gclid', 'adwords', 'googleads'],
        'snapchat' => ['snapchat', 'snap'],
        'youtube' => ['youtube', 'youtu.be'],
        'whatsapp' => ['whatsapp', 'wa.me'],
        'x' => ['twitter', 't.co', 'x.com', 'x'],
    ];

    public static function classify(?string $utmSource, ?string $referrer): string
    {
        $utm = mb_strtolower(trim((string) $utmSource));
        if ($utm !== '') {
            return self::match($utm, exact: true) ?? self::match($utm, exact: false) ?? 'other';
        }

        $host = mb_strtolower((string) (parse_url((string) $referrer, PHP_URL_HOST) ?: trim((string) $referrer)));
        if ($host === '') {
            return 'direct';
        }

        return self::match($host, exact: false) ?? 'other';
    }

    private static function match(string $value, bool $exact): ?string
    {
        foreach (self::MATCHES as $source => $needles) {
            foreach ($needles as $needle) {
                if ($exact ? $value === $needle : (mb_strlen($needle) > 2 && str_contains($value, $needle))) {
                    return $source;
                }
            }
        }

        return null;
    }
}
