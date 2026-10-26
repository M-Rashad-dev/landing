<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Lowercase latin/Arabic words joined by single dashes, 2–60 chars, not reserved. */
final class PageSlug implements ValidationRule
{
    public const PATTERN = '/^[a-z0-9\p{Arabic}]+(-[a-z0-9\p{Arabic}]+)*$/u';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('pages.slug_format'));

            return;
        }

        $length = mb_strlen($value);
        if ($length < 2 || $length > 60 || preg_match(self::PATTERN, $value) !== 1) {
            $fail(__('pages.slug_format'));

            return;
        }

        if (in_array($value, config('landing.reserved_slugs'), true) || str_contains($value, '--deleted-')) {
            $fail(__('pages.slug_reserved'));
        }
    }
}
