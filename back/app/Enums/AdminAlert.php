<?php

declare(strict_types=1);

namespace App\Enums;

/** What the platform owner can be told by email (each one switched on / off in the admin). */
enum AdminAlert: string
{
    case ReceiptSubmitted = 'receipt_submitted';
    case RefundRequested = 'refund_requested';
    case StoreRegistered = 'store_registered';
    case DailySummary = 'daily_summary';
    case SupportTicket = 'support_ticket';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
