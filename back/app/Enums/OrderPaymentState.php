<?php

declare(strict_types=1);

namespace App\Enums;

/** Where a prepaid order's payment is (orders.payment_status; null for cash on delivery). */
enum OrderPaymentState: string
{
    /** Waiting for the customer to pay and send the receipt. */
    case Unpaid = 'unpaid';
    /** A receipt waits for the merchant. */
    case Review = 'review';
    case Paid = 'paid';

    public function label(): string
    {
        return match ($this) {
            self::Unpaid => 'لسه مادفعش',
            self::Review => 'إيصال للمراجعة',
            self::Paid => 'مدفوع',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
