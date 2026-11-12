<?php

declare(strict_types=1);

namespace App\Enums;

/** What an offer, a discount code or a shipping offer covers. */
enum PromotionTarget: string
{
    case All = 'all';
    case Products = 'products';
    /** Products in the chosen categories or in any category under them. */
    case Categories = 'categories';

    public function label(): string
    {
        return match ($this) {
            self::All => 'كل المنتجات',
            self::Products => 'منتجات معينة',
            self::Categories => 'تصنيفات معينة',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
