<?php

declare(strict_types=1);

namespace App\Enums;

/** A refund: asked («مطلوب»), sent back to the customer, or called off. */
enum RefundStatus: string
{
    case Pending = 'pending';
    case Done = 'done';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'مطلوب',
            self::Done => 'اترجّع',
            self::Cancelled => 'اتلغى',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
