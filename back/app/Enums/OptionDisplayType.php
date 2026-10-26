<?php

declare(strict_types=1);

namespace App\Enums;

enum OptionDisplayType: string
{
    case Buttons = 'buttons';
    case Dropdown = 'dropdown';
    case Swatch = 'swatch';

    public function label(): string
    {
        return match ($this) {
            self::Buttons => 'أزرار',
            self::Dropdown => 'قائمة منسدلة',
            self::Swatch => 'ألوان',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
