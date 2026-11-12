<?php

declare(strict_types=1);

namespace App\Enums;

enum DiscountType: string
{
    case Percentage = 'percentage';
    case Fixed = 'fixed';
    /** No discount on the products: the delivery fee becomes zero. */
    case FreeShipping = 'free_shipping';

    public function label(): string
    {
        return match ($this) {
            self::Percentage => 'نسبة',
            self::Fixed => 'مبلغ ثابت',
            self::FreeShipping => 'شحن مجاني',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
