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
    /** Paid on the merchant's connected gateway (Paymob, Kashier, XPay): no receipt, the order confirms itself. */
    case Online = 'online';

    public function label(): string
    {
        return match ($this) {
            self::Instapay => 'إنستاباي',
            self::Wallet => 'محفظة موبايل',
            self::Bank => 'تحويل بنكي',
            self::Link => 'لينك دفع',
            self::Online => 'دفع أونلاين',
        };
    }

    /** The kinds a merchant adds by hand (an online method comes from connecting a gateway). @return list<self> */
    public static function manual(): array
    {
        return array_values(array_filter(self::cases(), fn (self $k) => $k !== self::Online));
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
