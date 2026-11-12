<?php

declare(strict_types=1);

namespace App\Store\Accounts;

/**
 * No provider yet (owner's decision): the code comes back in the answer and the sign-in box shows
 * it. Refused in production, where it would let anyone sign in as any phone.
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

    public function send(string $phone, string $code, string $storeName): bool
    {
        return true;
    }
}
