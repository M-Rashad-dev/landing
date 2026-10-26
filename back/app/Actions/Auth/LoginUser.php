<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Services\PhoneNormalizer;
use Illuminate\Support\Facades\Hash;

final class LoginUser
{
    public function __construct(
        private readonly PhoneNormalizer $phones,
        private readonly IssueToken $issueToken,
    ) {}

    /** @return array{user: User, token: string} */
    public function handle(string $login, string $password): array
    {
        $user = $this->findUser($login);

        // Same message whether the account exists or not.
        if ($user === null || ! Hash::check($password, $user->password)) {
            throw new ApiException(422, 'invalid_credentials', __('landing.login_failed'), [
                'login' => [__('landing.login_failed')],
            ]);
        }

        if (! $user->is_active) {
            throw ApiException::forbidden('account_inactive', __('landing.account_inactive'));
        }

        if (! $user->isSuperAdmin() && ($user->tenant === null || ! $user->tenant->isActive())) {
            throw ApiException::forbidden('tenant_suspended', __('landing.tenant_suspended'));
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return ['user' => $user, 'token' => $this->issueToken->handle($user)];
    }

    private function findUser(string $login): ?User
    {
        $login = trim($login);

        if (str_contains($login, '@')) {
            return User::query()->with('tenant')->where('email', mb_strtolower($login))->first();
        }

        $phone = $this->phones->normalize($login);

        return $phone === null ? null : User::query()->with('tenant')->where('phone', $phone)->first();
    }
}
