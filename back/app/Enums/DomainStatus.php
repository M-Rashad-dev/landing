<?php

declare(strict_types=1);

namespace App\Enums;

enum DomainStatus: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'قيد التحقق',
            self::Active => 'نشط',
            self::Failed => 'فشل التحقق',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
