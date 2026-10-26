<?php

declare(strict_types=1);

namespace App\Support;

use Carbon\CarbonImmutable;
use Throwable;

/**
 * Dates from the dashboard come as ISO strings in Cairo local time
 * ("2026-11-01T10:00"); an explicit offset/Z is respected. Stored as UTC.
 */
final class CairoTime
{
    public const ZONE = 'Africa/Cairo';

    public static function parse(?string $value): ?CarbonImmutable
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $value = trim($value);

        try {
            $hasZone = preg_match('/(Z|[+-]\d{2}:?\d{2})$/i', $value) === 1;
            $date = $hasZone ? CarbonImmutable::parse($value) : CarbonImmutable::parse($value, self::ZONE);

            return $date->utc();
        } catch (Throwable) {
            return null;
        }
    }

    public static function isValid(?string $value): bool
    {
        return $value === null || trim($value) === '' || self::parse($value) !== null;
    }
}
