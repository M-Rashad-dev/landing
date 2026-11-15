<?php

declare(strict_types=1);

namespace App\Enums;

/** Where an outbound message is, as Meta reports it. Only moves forward (a late "sent" never undoes "read"). */
enum MessageStatus: string
{
    case Pending = 'pending';
    case Sent = 'sent';
    case Delivered = 'delivered';
    case Read = 'read';
    case Failed = 'failed';

    public function rank(): int
    {
        return match ($this) {
            self::Pending => 0,
            self::Sent => 1,
            self::Delivered => 2,
            self::Read => 3,
            self::Failed => 4,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
