<?php

declare(strict_types=1);

namespace App\Enums;

/** What a shipping offer does to the delivery fee. */
enum ShippingBenefit: string
{
    case Free = 'free';
    /** value = amount taken off the fee. */
    case Discount = 'discount';
    /** value = the fee the customer pays (when lower than the company's fee). */
    case Flat = 'flat';

    public function label(): string
    {
        return match ($this) {
            self::Free => 'شحن مجاني',
            self::Discount => 'خصم على الشحن',
            self::Flat => 'سعر شحن ثابت',
        };
    }

    /** Fee after the offer (cents, never below zero, never above the fee). */
    public function apply(int $fee, int $value): int
    {
        return match ($this) {
            self::Free => 0,
            self::Discount => max(0, $fee - $value),
            self::Flat => min($fee, max(0, $value)),
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
