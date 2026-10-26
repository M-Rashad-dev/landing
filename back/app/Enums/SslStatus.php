<?php

declare(strict_types=1);

namespace App\Enums;

enum SslStatus: string
{
    case Pending = 'pending';
    case Issued = 'issued';
    case Unknown = 'unknown';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'قيد الإصدار',
            self::Issued => 'مفعّل',
            self::Unknown => 'غير مؤكد',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
