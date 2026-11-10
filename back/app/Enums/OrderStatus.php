<?php

declare(strict_types=1);

namespace App\Enums;

/** Order lifecycle (section 7.4). */
enum OrderStatus: string
{
    case New = 'new';
    case Confirmed = 'confirmed';
    case Delivered = 'delivered';
    case Returned = 'returned';
    case Damaged = 'damaged';
    case Fake = 'fake';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::New => 'جديد',
            self::Confirmed => 'مؤكد',
            self::Delivered => 'تم التسليم',
            self::Returned => 'مسترجع',
            self::Damaged => 'هالك',
            self::Fake => 'زائف',
            self::Cancelled => 'ملغي',
        };
    }

    /**
     * What the customer sees on the tracking page: internal states like "fake" or
     * "damaged" are never shown as such.
     */
    public function customerStage(): string
    {
        return match ($this) {
            self::New => 'received',
            self::Confirmed => 'confirmed',
            self::Delivered => 'delivered',
            self::Returned, self::Damaged => 'returned',
            self::Fake, self::Cancelled => 'cancelled',
        };
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::New => [self::Confirmed, self::Cancelled, self::Fake],
            self::Confirmed => [self::Delivered, self::Cancelled, self::Damaged, self::Fake],
            self::Delivered => [self::Returned],
            self::Cancelled, self::Fake => [self::New],
            self::Returned, self::Damaged => [],
        };
    }

    public function canTransitionTo(self $to): bool
    {
        return in_array($to, $this->allowedTransitions(), true);
    }

    /** Customer details may be edited only while the order is open. */
    public function allowsCustomerEdits(): bool
    {
        return $this === self::New || $this === self::Confirmed;
    }

    /** Moving here releases the discount code use. */
    public function releasesCode(): bool
    {
        return $this === self::Fake || $this === self::Cancelled;
    }

    /** Moving here returns the order's units to stock. */
    public function restocks(): bool
    {
        return $this === self::Fake || $this === self::Cancelled || $this === self::Returned;
    }

    /** Orders in these statuses don't count for duplicate detection. */
    public function isDismissed(): bool
    {
        return $this === self::Fake || $this === self::Cancelled;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $s) => $s->value, self::cases());
    }
}
