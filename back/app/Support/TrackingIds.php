<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Strict formats for tracking/verification ids. These values end up inside
 * <script> tags and meta tags on public pages, so nothing else is allowed.
 * The same patterns are mirrored in front/src/lib/tracking/ids.ts.
 */
final class TrackingIds
{
    public const PATTERNS = [
        'meta_pixel_id' => '/^\d{10,20}$/',
        'tiktok_pixel_id' => '/^[A-Z0-9]{10,30}$/',
        'ga4_id' => '/^G-[A-Z0-9]{6,14}$/',
        'gtm_id' => '/^GTM-[A-Z0-9]{4,10}$/',
        'snapchat_pixel_id' => '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
        'google_site_verification' => '/^[A-Za-z0-9_-]{10,100}$/',
        'facebook_domain_verification' => '/^[A-Za-z0-9_-]{10,100}$/',
    ];

    public const CONVERSION_EVENTS = ['Lead', 'Purchase'];

    /** Normalise user input before validation (trim; ids that are case-insensitive go upper). */
    public static function normalize(string $key, mixed $value): mixed
    {
        if (! is_string($value)) {
            return $value;
        }

        $value = trim($value);

        if ($value === '') {
            return null;
        }

        return match ($key) {
            'tiktok_pixel_id', 'ga4_id', 'gtm_id' => strtoupper($value),
            'snapchat_pixel_id' => strtolower($value),
            default => $value,
        };
    }

    /**
     * Validation rules for a tracking array under the given prefix (e.g. "tracking").
     *
     * @return array<string, list<string>>
     */
    public static function rules(string $prefix): array
    {
        $rules = [$prefix => ['nullable', 'array']];

        foreach (self::PATTERNS as $key => $pattern) {
            $rules["{$prefix}.{$key}"] = ['nullable', 'string', 'regex:'.$pattern];
        }

        $rules["{$prefix}.conversion_event"] = ['nullable', 'string', 'in:'.implode(',', self::CONVERSION_EVENTS)];

        return $rules;
    }
}
