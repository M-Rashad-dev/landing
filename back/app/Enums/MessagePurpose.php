<?php

declare(strict_types=1);

namespace App\Enums;

/** Why the platform sent a message (shown in the admin's message log). */
enum MessagePurpose: string
{
    case CustomerCode = 'customer_code';
    case MerchantCode = 'merchant_code';
    case AutoReply = 'auto_reply';
    case Notification = 'notification';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
