<?php

declare(strict_types=1);

namespace App\Enums;

enum OfferType: string
{
    case Percentage = 'percentage';
    case Fixed = 'fixed';
    case Bundle = 'bundle';
    /** Buy min_quantity, get free_quantity more of the same product free (e.g. buy 5, the 6th free). */
    case BuyGet = 'buy_get';
    /** Buy min_quantity, get gift_product_id free (e.g. the shoes + free socks). */
    case Gift = 'gift';

    public function label(): string
    {
        return match ($this) {
            self::Percentage => 'نسبة خصم',
            self::Fixed => 'خصم مبلغ على القطعة',
            self::Bundle => 'اشترِ كمية بسعر',
            self::BuyGet => 'اشترِ واحصل على قطع مجانًا',
            self::Gift => 'هدية منتج',
        };
    }

    /** Types that use min_quantity as their condition. */
    public function usesMinQuantity(): bool
    {
        return in_array($this, [self::Percentage, self::Fixed, self::BuyGet, self::Gift], true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
