<?php

declare(strict_types=1);

namespace App\Enums;

/** What happened when the seller tried to reach the customer about a new order. */
enum ContactResult: string
{
    case NoAnswer = 'no_answer';
    case Postponed = 'postponed';
    case Whatsapp = 'whatsapp';

    public function label(): string
    {
        return match ($this) {
            self::NoAnswer => 'لم يرد',
            self::Postponed => 'مؤجل',
            self::Whatsapp => 'تم إرسال واتساب',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
