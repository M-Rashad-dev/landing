<?php

declare(strict_types=1);

namespace App\Enums;

/** How a digital product reaches the customer once his payment is confirmed. */
enum DeliveryType: string
{
    /** Files to download (PDF, Word, ZIP…), a number of downloads per purchase. */
    case Files = 'files';
    /** Entries from the merchant's list (a code, an email + password…), one per unit bought. */
    case Codes = 'codes';
    /** A link opened through us (counted), a number of opens per purchase. */
    case Links = 'links';
    /** Done by the merchant (followers, a top-up…), who then sends the message. */
    case Services = 'services';

    public function label(): string
    {
        return match ($this) {
            self::Files => 'ملفات',
            self::Codes => 'أكواد',
            self::Links => 'رابط',
            self::Services => 'خدمة',
        };
    }

    /** Delivered by itself after the payment (services wait for the merchant). */
    public function automatic(): bool
    {
        return $this !== self::Services;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
