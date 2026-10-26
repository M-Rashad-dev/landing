<?php

declare(strict_types=1);

namespace App\Enums;

enum UserRole: string
{
    case Owner = 'owner';
    case SuperAdmin = 'super_admin';

    public function label(): string
    {
        return match ($this) {
            self::Owner => 'مالك المتجر',
            self::SuperAdmin => 'مدير المنصة',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
