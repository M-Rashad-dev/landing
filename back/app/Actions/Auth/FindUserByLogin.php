<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Models\User;
use App\Services\PhoneNormalizer;

/** The dashboard user behind what was typed in the sign-in box: an email, or an Egyptian mobile. */
final class FindUserByLogin
{
    public function __construct(private readonly PhoneNormalizer $phones) {}

    public function handle(string $login): ?User
    {
        $login = trim($login);

        if (str_contains($login, '@')) {
            return User::query()->with('tenant')->where('email', mb_strtolower($login))->first();
        }

        $phone = $this->phones->normalize($login);

        return $phone === null ? null : User::query()->with('tenant')->where('phone', $phone)->first();
    }

    /** One key per account whichever way it was typed (for rate limits). */
    public function key(string $login): string
    {
        $login = mb_strtolower(trim($login));

        return str_contains($login, '@') ? $login : ($this->phones->normalize($login) ?? $login);
    }
}
