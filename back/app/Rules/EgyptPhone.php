<?php

declare(strict_types=1);

namespace App\Rules;

use App\Services\PhoneNormalizer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

final class EgyptPhone implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! app(PhoneNormalizer::class)->isValid($value)) {
            $fail(__('landing.phone_invalid'));
        }
    }
}
