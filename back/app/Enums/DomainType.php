<?php

declare(strict_types=1);

namespace App\Enums;

enum DomainType: string
{
    case Subdomain = 'subdomain';
    case Custom = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::Subdomain => 'نطاق فرعي مجاني',
            self::Custom => 'نطاق خاص',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
