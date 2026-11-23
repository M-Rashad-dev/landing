<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Exceptions\ApiException;
use App\Models\ActivityLog;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\Hash;

final class LoginUser
{
    public function __construct(
        private readonly FindUserByLogin $findUser,
        private readonly IssueToken $issueToken,
    ) {}

    /** @return array{user: User, token: string} */
    public function handle(string $login, string $password): array
    {
        $user = $this->findUser->handle($login);

        // Same message whether the account exists or not.
        if ($user === null || ! Hash::check($password, $user->password)) {
            throw new ApiException(422, 'invalid_credentials', __('landing.login_failed'), [
                'login' => [__('landing.login_failed')],
            ]);
        }

        if (! $user->is_active || ($user->isStaff() && $user->locked_by_plan)) {
            throw ApiException::forbidden('account_inactive', __('landing.account_inactive'));
        }

        if (! $user->isSuperAdmin() && ($user->tenant === null || ! $user->tenant->isActive())) {
            throw ApiException::forbidden('tenant_suspended', __('landing.tenant_suspended'));
        }

        $user->forceFill(['last_login_at' => now()])->save();
        // «سجل النشاط»: who signed in to the store.
        if ($user->tenant_id !== null) {
            Tenancy::runAs($user->tenant_id, fn () => ActivityLog::query()->create(['user_id' => $user->id, 'method' => 'POST', 'path' => 'api/v1/auth/login', 'summary' => (string) __('staff.signed_in'), 'ip' => request()->ip()]));
        }

        return ['user' => $user, 'token' => $this->issueToken->handle($user)];
    }
}
