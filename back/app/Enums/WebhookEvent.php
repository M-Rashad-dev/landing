<?php

declare(strict_types=1);

namespace App\Enums;

enum WebhookEvent: string
{
    case OrderCreated = 'order.created';
    case OrderStatusChanged = 'order.status_changed';
    /** Customer details edited, or the post-order offer added. */
    case OrderUpdated = 'order.updated';
    case LeadCreated = 'lead.created';
    /** Sent only by the "send test" button. */
    case Test = 'test';

    /** @return list<string> events a merchant can subscribe to */
    public static function subscribable(): array
    {
        return [self::OrderCreated->value, self::OrderStatusChanged->value, self::OrderUpdated->value, self::LeadCreated->value];
    }
}
