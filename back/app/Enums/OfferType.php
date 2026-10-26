<?php

declare(strict_types=1);

namespace App\Enums;

enum OfferType: string
{
    case Percentage = 'percentage';
    case Fixed = 'fixed';
    case Bundle = 'bundle';

    public function label(): string
    {
        return match ($this) {
            self::Percentage => 'نسبة خصم',
            self::Fixed => 'خصم مبلغ على القطعة',
            self::Bundle => 'اشترِ كمية بسعر',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
