<?php

declare(strict_types=1);

namespace App\Enums;

/** Why the platform sent a message (shown in the admin's message log). */
enum MessagePurpose: string
{
    case CustomerCode = 'customer_code';
    case MerchantCode = 'merchant_code';
    case AutoReply = 'auto_reply';
    case Notification = 'notification';
    case OrderReceived = 'order_received';
    case OrderShipped = 'order_shipped';
    case OrderCancelled = 'order_cancelled';
    case OrderDelivered = 'order_delivered';
    case OrderPaymentDue = 'order_payment_due';
    case OrderPaymentConfirmed = 'order_payment_confirmed';
    case OrderPaymentRejected = 'order_payment_rejected';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
