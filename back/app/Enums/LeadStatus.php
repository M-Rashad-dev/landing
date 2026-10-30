<?php

declare(strict_types=1);

namespace App\Enums;

/** Abandoned order form: open → contacted / dismissed; converted when the phone orders. */
enum LeadStatus: string
{
    case Open = 'open';
    case Contacted = 'contacted';
    case Converted = 'converted';
    case Dismissed = 'dismissed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'جديد',
            self::Contacted => 'تم التواصل',
            self::Converted => 'طلب بعدها',
            self::Dismissed => 'مستبعد',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
