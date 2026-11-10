<?php

declare(strict_types=1);

namespace App\Enums;

enum SubscriptionSource: string
{
    case Trial = 'trial';
    case Payment = 'payment';
    case AdminGrant = 'admin_grant';

    /** Paid subscriptions count for upgrade-difference and refund rules. */
    public function isPaid(): bool
    {
        return $this === self::Payment;
    }
}
