<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Enums\OrderStatus;
use App\Jobs\DeliverCustomerNotice;
use App\Models\Order;

/**
 * What a customer is told about their order (received, shipped, cancelled, delivered), sent
 * after the order's transaction by DeliverCustomerNotice: by email when they have one, else on
 * WhatsApp if they agreed at checkout; their own choice in their store account wins.
 */
final class CustomerNotices
{
    public const RECEIVED = 'received';

    public const SHIPPED = 'shipped';

    public const CANCELLED = 'cancelled';

    public const DELIVERED = 'delivered';

    /** A prepaid order: how to pay and where to send the receipt (email only, no WhatsApp template). */
    public const PAYMENT_DUE = 'payment_due';

    public const PAYMENT_CONFIRMED = 'payment_confirmed';

    public const PAYMENT_REJECTED = 'payment_rejected';

    public function received(Order $order): void
    {
        DeliverCustomerNotice::dispatch($order->tenant_id, $order->id, $order->status === OrderStatus::AwaitingPayment ? self::PAYMENT_DUE : self::RECEIVED)->afterCommit();
    }

    public function paymentRejected(Order $order): void
    {
        DeliverCustomerNotice::dispatch($order->tenant_id, $order->id, self::PAYMENT_REJECTED)->afterCommit();
    }

    public function statusChanged(Order $order, OrderStatus $to): void
    {
        $event = match ($to) {
            OrderStatus::Shipped => self::SHIPPED,
            OrderStatus::Cancelled => self::CANCELLED,
            OrderStatus::Delivered => self::DELIVERED,
            OrderStatus::Confirmed => $order->isPrepaid() ? self::PAYMENT_CONFIRMED : null,
            default => null,
        };
        if ($event !== null) {
            DeliverCustomerNotice::dispatch($order->tenant_id, $order->id, $event)->afterCommit();
        }
    }
}
