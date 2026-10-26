<?php

declare(strict_types=1);

namespace App\Rules;

use App\Support\CairoTime;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class CairoDateTime implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/', $value) || CairoTime::parse($value) === null) {
            $fail('validation.date')->translate();
        }
    }
}
