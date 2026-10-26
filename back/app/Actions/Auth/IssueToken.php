<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Models\User;

final class IssueToken
{
    public function handle(User $user, string $name = 'dashboard'): string
    {
        $expiresAt = now()->addDays((int) config('landing.token_ttl_days'));

        return $user->createToken($name, ['*'], $expiresAt)->plainTextToken;
    }
}
