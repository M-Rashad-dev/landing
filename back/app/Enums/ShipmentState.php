<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Where a shipment is, in our words (every carrier's own states map onto these). It moves the order: picked up and
 * on the way → shipped, delivered → delivered, back at the store → returned, lost / damaged → damaged.
 */
enum ShipmentState: string
{
    /** Created at the carrier, waiting for its courier. */
    case Created = 'created';
    case PickedUp = 'picked_up';
    case InTransit = 'in_transit';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
    /** Refused or undeliverable: on its way back to the store. */
    case Returning = 'returning';
    case Returned = 'returned';
    /** A delivery problem the merchant may need to act on (customer not answering, postponed, on hold…). */
    case Exception = 'exception';
    case Cancelled = 'cancelled';
    case Lost = 'lost';
    case Damaged = 'damaged';

    public function label(): string
    {
        return match ($this) {
            self::Created => 'مستني المندوب',
            self::PickedUp => 'المندوب استلم',
            self::InTransit => 'في الطريق',
            self::OutForDelivery => 'خرج للتوصيل',
            self::Delivered => 'اتسلم',
            self::Returning => 'راجع للمتجر',
            self::Returned => 'رجع للمتجر',
            self::Exception => 'فيه مشكلة',
            self::Cancelled => 'اتلغت',
            self::Lost => 'ضاعت',
            self::Damaged => 'اتلفت',
        };
    }

    /** Still moving (a new shipment for the order is refused while one is open). */
    public function isOpen(): bool
    {
        return ! in_array($this, [self::Delivered, self::Returned, self::Cancelled, self::Lost, self::Damaged], true);
    }

    /** The order status this state leads to (null: the order stays as it is). */
    public function orderStatus(): ?OrderStatus
    {
        return match ($this) {
            self::PickedUp, self::InTransit, self::OutForDelivery, self::Returning => OrderStatus::Shipped,
            self::Delivered => OrderStatus::Delivered,
            self::Returned => OrderStatus::Returned,
            self::Lost, self::Damaged => OrderStatus::Damaged,
            default => null,
        };
    }

    /** The merchant is told (bell, email). */
    public function isProblem(): bool
    {
        return in_array($this, [self::Exception, self::Returning, self::Lost, self::Damaged], true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
