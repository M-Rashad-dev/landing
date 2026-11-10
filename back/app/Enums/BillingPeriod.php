<?php

declare(strict_types=1);

namespace App\Enums;

enum BillingPeriod: string
{
    case Monthly = 'monthly';
    case Yearly = 'yearly';

    /** A month is 30 days and a year 365 days (owner decision). */
    public function days(): int
    {
        return match ($this) {
            self::Monthly => 30,
            self::Yearly => 365,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Monthly => 'شهري',
            self::Yearly => 'سنوي',
        };
    }
}
