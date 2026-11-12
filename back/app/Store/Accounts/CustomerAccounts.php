<?php

declare(strict_types=1);

namespace App\Store\Accounts;

use App\Exceptions\ApiException;
use App\Models\Customer;
use App\Models\CustomerLoginCode;
use App\Models\CustomerToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Storefront sign-in with the phone and a one-time code, on the store's customers row (one per
 * phone). Runs inside the store's tenant context. Codes and tokens are kept as hashes only.
 */
final class CustomerAccounts
{
    public const CODE_TTL = 300;

    public const RESEND_AFTER = 60;

    public const MAX_ATTEMPTS = 5;

    public const CODES_PER_HOUR = 5;

    public const TOKEN_DAYS = 90;

    public function __construct(private readonly CodeSender $sender) {}

    /**
     * A new code for the phone (the previous one stops working).
     *
     * @return array{channel: string, expires_in: int, resend_in: int, code: string|null}
     */
    public function sendCode(int $tenantId, string $phone, ?string $ip, string $storeName): array
    {
        if (! $this->sender->available()) {
            throw new ApiException(503, 'sign_in_unavailable', __('accounts.unavailable'));
        }

        $wait = "customer-code-wait:{$tenantId}:{$phone}";
        if (RateLimiter::tooManyAttempts($wait, 1)) {
            throw new ApiException(429, 'code_wait', __('accounts.wait', ['seconds' => RateLimiter::availableIn($wait)]));
        }
        $hourly = "customer-code-hour:{$tenantId}:{$phone}";
        $byIp = 'customer-code-ip:'.($ip ?? 'none');
        if (RateLimiter::tooManyAttempts($hourly, self::CODES_PER_HOUR) || ($ip !== null && RateLimiter::tooManyAttempts($byIp, 20))) {
            throw new ApiException(429, 'too_many_codes', __('accounts.too_many'));
        }
        RateLimiter::hit($wait, self::RESEND_AFTER);
        RateLimiter::hit($hourly, 3600);
        if ($ip !== null) {
            RateLimiter::hit($byIp, 3600);
        }

        $code = (string) random_int(100000, 999999);
        DB::transaction(function () use ($phone, $code, $ip): void {
            CustomerLoginCode::query()->where('phone', $phone)->whereNull('consumed_at')->update(['consumed_at' => now()]);
            CustomerLoginCode::query()->create(['phone' => $phone, 'code_hash' => self::hash($phone, $code), 'expires_at' => now()->addSeconds(self::CODE_TTL), 'ip' => $ip]);
        });
        $reveal = $this->sender->send($phone, $code, $storeName);

        return ['channel' => $this->sender->channel(), 'expires_in' => self::CODE_TTL, 'resend_in' => self::RESEND_AFTER, 'code' => $reveal ? $code : null];
    }

    /**
     * Checks the code; on success signs the customer in (made now if the phone never ordered).
     *
     * @return array{token: string, customer: Customer}
     */
    public function verify(string $phone, string $code, ?string $userAgent): array
    {
        $login = CustomerLoginCode::query()->where('phone', $phone)->whereNull('consumed_at')->where('expires_at', '>', now())->latest('id')->first();
        if ($login === null || $login->attempts >= self::MAX_ATTEMPTS) {
            throw ValidationException::withMessages(['code' => [__('accounts.code_expired')]]);
        }
        if (! hash_equals($login->code_hash, self::hash($phone, $code))) {
            // Counted outside any transaction: a wrong guess always uses up an attempt.
            $login->increment('attempts');
            $left = self::MAX_ATTEMPTS - $login->attempts;
            throw ValidationException::withMessages(['code' => [$left > 0 ? __('accounts.code_wrong', ['left' => $left]) : __('accounts.code_expired')]]);
        }
        // One use only, even for two requests at the same moment.
        $used = CustomerLoginCode::query()->whereKey($login->id)->whereNull('consumed_at')->where('attempts', '<', self::MAX_ATTEMPTS)->update(['consumed_at' => now()]);
        if ($used !== 1) {
            throw ValidationException::withMessages(['code' => [__('accounts.code_expired')]]);
        }

        return DB::transaction(function () use ($phone, $userAgent) {
            $customer = Customer::query()->createOrFirst(['phone' => $phone]);
            if ($customer->signed_up_at === null) {
                $customer->forceFill(['signed_up_at' => now()])->save();
            }

            $token = Str::random(64);
            CustomerToken::query()->create([
                'customer_id' => $customer->id,
                'token_hash' => hash('sha256', $token),
                'user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 300),
                'last_used_at' => now(),
                'expires_at' => now()->addDays(self::TOKEN_DAYS),
            ]);

            return ['token' => $token, 'customer' => $customer];
        });
    }

    /** The signed-in customer of a token, or null (unknown, expired, or another store's). */
    public function customer(?string $token): ?Customer
    {
        if ($token === null || ! preg_match('/^[A-Za-z0-9]{64}$/', $token)) {
            return null;
        }
        $row = CustomerToken::query()->with('customer')->where('token_hash', hash('sha256', $token))->where('expires_at', '>', now())->first();
        if ($row === null || $row->customer === null) {
            return null;
        }
        if ($row->last_used_at === null || $row->last_used_at->lt(now()->subMinutes(10))) {
            $row->forceFill(['last_used_at' => now()])->save();
        }

        return $row->customer;
    }

    public function signOut(string $token): void
    {
        CustomerToken::query()->where('token_hash', hash('sha256', $token))->delete();
    }

    private static function hash(string $phone, string $code): string
    {
        return hash_hmac('sha256', $phone.'|'.$code, (string) config('app.key'));
    }
}
