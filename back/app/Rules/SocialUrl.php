<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** https link whose host belongs to the given social network. */
final class SocialUrl implements ValidationRule
{
    /** @var array<string, list<string>> */
    public const DOMAINS = [
        'facebook' => ['facebook.com', 'fb.com'],
        'instagram' => ['instagram.com'],
        'tiktok' => ['tiktok.com'],
        'youtube' => ['youtube.com', 'youtu.be'],
        'x' => ['x.com', 'twitter.com'],
        'snapchat' => ['snapchat.com'],
    ];

    public function __construct(private readonly string $network) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || mb_strlen($value) > 500 || filter_var($value, FILTER_VALIDATE_URL) === false) {
            $fail(__('landing.social_invalid'));

            return;
        }

        $parts = parse_url($value);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if ($scheme !== 'https' || isset($parts['user']) || isset($parts['pass'])) {
            $fail(__('landing.social_invalid'));

            return;
        }

        foreach (self::DOMAINS[$this->network] ?? [] as $domain) {
            if ($host === $domain || str_ends_with($host, '.'.$domain)) {
                return;
            }
        }

        $fail(__('landing.social_wrong_network'));
    }
}
