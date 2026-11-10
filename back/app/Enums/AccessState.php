<?php

declare(strict_types=1);

namespace App\Enums;

/** A tenant's access right now, derived from its plan dates (no job needed to flip it). */
enum AccessState: string
{
    case Active = 'active';
    /** Period over, still fully working for the grace hours. */
    case Grace = 'grace';
    /** No running subscription: public sites closed, dashboard read-only. */
    case Expired = 'expired';

    public function isOpen(): bool
    {
        return $this !== self::Expired;
    }
}
