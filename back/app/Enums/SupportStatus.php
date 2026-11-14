<?php

declare(strict_types=1);

namespace App\Enums;

/** Whose turn it is in a support conversation. */
enum SupportStatus: string
{
    /** The merchant wrote last: support owes a reply. */
    case WaitingSupport = 'waiting_support';
    /** Support replied: the merchant's turn (auto-closes after the idle hours). */
    case WaitingMerchant = 'waiting_merchant';
    case Closed = 'closed';

    public function isOpen(): bool
    {
        return $this !== self::Closed;
    }
}
