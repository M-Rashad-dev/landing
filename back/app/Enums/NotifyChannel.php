<?php

declare(strict_types=1);

namespace App\Enums;

/** Where a dashboard user's notifications go besides the bell (the bell always gets them). */
enum NotifyChannel: string
{
    case WhatsApp = 'whatsapp';
    case Email = 'email';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
