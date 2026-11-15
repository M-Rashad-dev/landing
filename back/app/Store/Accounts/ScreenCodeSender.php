<?php

declare(strict_types=1);

namespace App\Store\Accounts;

/**
 * WhatsApp keys not set (local development): the code comes back in the answer and the sign-in
 * box shows it. Refused in production, where it would let anyone sign in as any phone.
 */
final class ScreenCodeSender implements CodeSender
{
    public function channel(): string
    {
        return 'screen';
    }

    public function available(): bool
    {
        return ! app()->isProduction();
    }

    public function send(string $phone, string $code, string $storeName, ?int $tenantId): bool
    {
        return true;
    }
}
