<?php

declare(strict_types=1);

namespace App\Enums;

/** What a support conversation is about (chosen when it is opened). */
enum SupportTopic: string
{
    case Orders = 'orders';
    case Billing = 'billing';
    case Domain = 'domain';
    case Design = 'design';
    case Products = 'products';
    case Technical = 'technical';
    case Other = 'other';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
