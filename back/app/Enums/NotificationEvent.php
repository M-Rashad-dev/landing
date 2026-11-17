<?php

declare(strict_types=1);

namespace App\Enums;

/** What a dashboard user is told about. Admin events share their names with AdminAlert (the admin's on / off list). */
enum NotificationEvent: string
{
    // The store owner.
    case NewOrder = 'new_order';
    case LowStock = 'low_stock';
    case PlanExpiring = 'plan_expiring';
    case PlanExpired = 'plan_expired';
    case ReceiptApproved = 'receipt_approved';
    case ReceiptRejected = 'receipt_rejected';
    case SupportReply = 'support_reply';
    case DomainReady = 'domain_ready';
    case ImportDone = 'import_done';

    // The platform owner.
    case ReceiptSubmitted = 'receipt_submitted';
    case RefundRequested = 'refund_requested';
    case StoreRegistered = 'store_registered';
    case SupportTicket = 'support_ticket';
    case DailySummary = 'daily_summary';
    /** The AI paused itself after failures in a row (bell only). */
    case AiPaused = 'ai_paused';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
