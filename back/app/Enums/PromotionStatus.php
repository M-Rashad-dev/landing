<?php

declare(strict_types=1);

namespace App\Enums;

use Carbon\CarbonInterface;

/** Status of an offer or code, computed from is_active and its time window. */
enum PromotionStatus: string
{
    case Inactive = 'inactive';
    case Scheduled = 'scheduled';
    case Active = 'active';
    case Expired = 'expired';

    public function label(): string
    {
        return match ($this) {
            self::Inactive => 'متوقف',
            self::Scheduled => 'مجدول',
            self::Active => 'نشط',
            self::Expired => 'منتهي',
        };
    }

    public static function compute(bool $isActive, ?CarbonInterface $startsAt, ?CarbonInterface $endsAt, CarbonInterface $now): self
    {
        if (! $isActive) {
            return self::Inactive;
        }

        if ($endsAt !== null && $now->greaterThan($endsAt)) {
            return self::Expired;
        }

        if ($startsAt !== null && $now->lessThan($startsAt)) {
            return self::Scheduled;
        }

        return self::Active;
    }
}
