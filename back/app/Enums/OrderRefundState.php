<?php

declare(strict_types=1);

namespace App\Enums;

/** How much of an order's collected money went back (orders.refund_state; null = nothing). */
enum OrderRefundState: string
{
    case Partial = 'partial';
    case Full = 'full';

    public function label(): string
    {
        return match ($this) {
            self::Partial => 'اترجّع جزء',
            self::Full => 'اترجّع كله',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
