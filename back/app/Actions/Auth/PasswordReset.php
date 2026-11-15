<?php

declare(strict_types=1);

namespace App\Actions\Auth;

use App\Enums\MessagePurpose;
use App\Exceptions\ApiException;
use App\Messaging\WhatsApp\WhatsAppError;
use App\Messaging\WhatsApp\WhatsAppMessenger;
use App\Models\PasswordResetCode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * "Forgot my password" for dashboard users: a 6-digit code on WhatsApp to the account's phone,
 * then a new password (every signed-in session is ended). The answer never says whether the
 * account exists. Without WhatsApp keys the code is shown on screen, never in production.
 */
final class PasswordReset
{
    public const CODE_TTL = 300;

    public const RESEND_AFTER = 60;

    public const MAX_ATTEMPTS = 5;

    public const CODES_PER_HOUR = 5;

    public function __construct(
        private readonly FindUserByLogin $findUser,
        private readonly WhatsAppMessenger $messenger,
    ) {}

    /** @return array{channel: string, expires_in: int, resend_in: int, code: string|null} */
    public function sendCode(string $login, ?string $ip): array
    {
        $onScreen = ! $this->messenger->configured();
        if ($onScreen && app()->isProduction()) {
            throw new ApiException(503, 'reset_unavailable', __('auth_reset.unavailable'));
        }

        $key = $this->findUser->key($login);
        $wait = "password-code-wait:{$key}";
        if (RateLimiter::tooManyAttempts($wait, 1)) {
            throw new ApiException(429, 'code_wait', __('accounts.wait', ['seconds' => RateLimiter::availableIn($wait)]));
        }
        $hourly = "password-code-hour:{$key}";
        $byIp = 'password-code-ip:'.($ip ?? 'none');
        if (RateLimiter::tooManyAttempts($hourly, self::CODES_PER_HOUR) || ($ip !== null && RateLimiter::tooManyAttempts($byIp, 20))) {
            throw new ApiException(429, 'too_many_codes', __('accounts.too_many'));
        }
        RateLimiter::hit($wait, self::RESEND_AFTER);
        RateLimiter::hit($hourly, 3600);
        if ($ip !== null) {
            RateLimiter::hit($byIp, 3600);
        }

        $answer = ['channel' => $onScreen ? 'screen' : 'whatsapp', 'expires_in' => self::CODE_TTL, 'resend_in' => self::RESEND_AFTER, 'code' => null];

        $user = $this->findUser->handle($login);
        if ($user === null || ! $user->is_active || $user->phone === null || $user->phone === '') {
            return $answer;
        }

        $code = (string) random_int(100000, 999999);
        DB::transaction(function () use ($user, $code, $ip): void {
            PasswordResetCode::query()->where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);
            PasswordResetCode::query()->create(['user_id' => $user->id, 'code_hash' => self::hash($user, $code), 'expires_at' => now()->addSeconds(self::CODE_TTL), 'ip' => $ip]);
        });

        if ($onScreen) {
            return ['code' => $code] + $answer;
        }

        try {
            $this->messenger->sendCode($user->phone, $code, MessagePurpose::MerchantCode, $user->tenant_id);
        } catch (WhatsAppError $e) {
            report($e);
            throw new ApiException(503, 'code_not_sent', __('accounts.code_not_sent'));
        }

        return $answer;
    }

    /** Checks the code and sets the new password; signs the account out everywhere. */
    public function reset(string $login, string $code, string $password): void
    {
        $user = $this->findUser->handle($login);
        $row = $user === null ? null : PasswordResetCode::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();

        if ($user === null || $row === null || $row->attempts >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => [__('accounts.code_expired')]]);
        }

        if (! hash_equals($row->code_hash, self::hash($user, $code))) {
            // Counted outside any transaction: a wrong guess always uses up an attempt.
            $row->increment('attempts');
            $left = self::MAX_ATTEMPTS - $row->attempts;
            throw ValidationException::withMessages(['code' => [$left > 0 ? __('accounts.code_wrong', ['left' => $left]) : __('accounts.code_expired')]]);
        }

        DB::transaction(function () use ($user, $row, $password): void {
            $used = PasswordResetCode::query()->whereKey($row->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);
            if ($used !== 1) {
                throw ValidationException::withMessages(['code' => [__('accounts.code_expired')]]);
            }
            $user->forceFill(['password' => Hash::make($password)])->save();
            $user->tokens()->delete();
        });
    }

    private static function hash(User $user, string $code): string
    {
        return hash_hmac('sha256', $user->id.'|'.$code, (string) config('app.key'));
    }
}
