<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Normalizes Egyptian mobile numbers to E.164 (+201XXXXXXXXX).
 * Accepts 01X…, +201X…, 00201X…, 201X… with Arabic-Indic digits and separators.
 */
final class PhoneNormalizer
{
    private const MOBILE = '1[0125]\d{8}';

    public function normalize(?string $input): ?string
    {
        if ($input === null) {
            return null;
        }

        $digits = strtr($input, [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);

        $digits = (string) preg_replace('/[\s\-().\x{200E}\x{200F}\x{202A}-\x{202E}]+/u', '', $digits);

        $patterns = [
            '/^0('.self::MOBILE.')$/',
            '/^\+20('.self::MOBILE.')$/',
            '/^0020('.self::MOBILE.')$/',
            '/^20('.self::MOBILE.')$/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $digits, $m) === 1) {
                return '+20'.$m[1];
            }
        }

        return null;
    }

    public function isValid(?string $input): bool
    {
        return $this->normalize($input) !== null;
    }
}
