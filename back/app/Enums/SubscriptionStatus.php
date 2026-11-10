<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Stored status of a subscription row. Whether it is running is derived from its dates;
 * replaced / refunded / cancelled rows never give access again.
 */
enum SubscriptionStatus: string
{
    case Active = 'active';
    /** Ended early by an upgrade (the new row carries on). */
    case Replaced = 'replaced';
    case Refunded = 'refunded';
    case Cancelled = 'cancelled';
}
