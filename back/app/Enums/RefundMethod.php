<?php

declare(strict_types=1);

namespace App\Enums;

/** How the money goes back: the way the customer paid, or another way the merchant chooses. */
enum RefundMethod: string
{
    /** The order's own payment method (the prepaid method's name, or cash for cash on delivery). */
    case Original = 'original';
    case Wallet = 'wallet';
    case Instapay = 'instapay';
    case Bank = 'bank';
    case Cash = 'cash';
    /** Sent back by the gateway itself to the same card / wallet (orders paid online with the store's gateway). */
    case Gateway = 'gateway';

    public function label(): string
    {
        return match ($this) {
            self::Original => 'نفس طريقة الدفع',
            self::Wallet => 'محفظة',
            self::Instapay => 'إنستاباي',
            self::Bank => 'تحويل بنكي',
            self::Cash => 'كاش',
            self::Gateway => 'رجوع تلقائي على نفس الكارت أو المحفظة',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
