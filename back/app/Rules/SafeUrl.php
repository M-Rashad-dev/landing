<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Link allow-list for page content (mirror of front/src/lib/links.ts):
 * #anchor, /relative-path, https://…, tel:+digits, mailto:…, https://wa.me/….
 * Rejects javascript:, data:, http:, protocol-relative //… and anything with control characters.
 */
final class SafeUrl implements ValidationRule
{
    public const AUDIO_LOCAL_PATTERN = '#^/media/tenants/\d+/\d{4}/\d{2}/[a-z0-9]+-audio\.(mp3|wav|ogg|m4a|aac|webm)$#';

    public function __construct(private readonly string $mode = 'link') {}

    public static function isHttps(string $value): bool
    {
        if ($value === '' || mb_strlen($value) > 2048 || preg_match('/[\x00-\x20\x7F]/', $value) === 1) {
            return false;
        }

        if (preg_match('#^https://#i', $value) !== 1) {
            return false;
        }

        $parts = parse_url($value);

        return is_array($parts)
            && strtolower((string) ($parts['scheme'] ?? '')) === 'https'
            && ($parts['host'] ?? '') !== ''
            && ! isset($parts['user'])
            && ! isset($parts['pass']);
    }

    public static function isAudioUrl(string $value): bool
    {
        if (self::isHttps($value)) {
            return true;
        }

        return preg_match(self::AUDIO_LOCAL_PATTERN, $value) === 1;
    }

    public static function isSafe(string $value): bool
    {
        if ($value === '' || mb_strlen($value) > 2048 || preg_match('/[\x00-\x20\x7F]/', $value) === 1) {
            return false;
        }

        if (preg_match('/^#[A-Za-z0-9_-]{1,80}$/', $value) === 1) {
            return true;
        }

        if (preg_match('#^/(?!/)[^\\\\]*$#u', $value) === 1) {
            return true;
        }

        if (preg_match('/^tel:\+?[0-9]{3,20}$/', $value) === 1) {
            return true;
        }

        if (preg_match('/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i', $value) === 1) {
            return true;
        }

        return self::isHttps($value);
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('pages.unsafe_url'));

            return;
        }

        $trimmed = trim($value);
        $ok = match ($this->mode) {
            'https' => self::isHttps($trimmed),
            'audio' => self::isAudioUrl($trimmed),
            default => self::isSafe($trimmed),
        };

        if (! $ok) {
            $fail(__('pages.unsafe_url'));
        }
    }
}
