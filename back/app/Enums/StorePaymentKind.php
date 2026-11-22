<?php

declare(strict_types=1);

namespace App\Enums;

/** A store's own way to be paid before delivery (the customer pays it directly, then sends the receipt). */
enum StorePaymentKind: string
{
    case Instapay = 'instapay';
    /** Vodafone Cash, Orange Cash, Etisalat Cash, WE Pay… */
    case Wallet = 'wallet';
    case Bank = 'bank';
    /** The merchant's own payment page (Paymob link, Fawry, PayPal…). */
    case Link = 'link';

    public function label(): string
    {
        return match ($this) {
            self::Instapay => 'إنستاباي',
            self::Wallet => 'محفظة موبايل',
            self::Bank => 'تحويل بنكي',
            self::Link => 'لينك دفع',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
