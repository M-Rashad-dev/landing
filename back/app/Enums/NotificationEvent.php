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
    case AiLowBalance = 'ai_low_balance';
    /** A shipment needs the merchant (customer not answering, returning, lost…) or an order couldn't be shipped. */
    case ShipmentProblem = 'shipment_problem';
    /** The store's own mailbox refused; its customer emails went from the platform's address. */
    case MailboxFailed = 'mailbox_failed';
    /** A customer sent the receipt of a prepaid order. */
    case PaymentReceipt = 'payment_receipt';
    /** A customer cancelled on WhatsApp or asked for a call. */
    case CustomerReply = 'customer_reply';

    // The platform owner.
    case ReceiptSubmitted = 'receipt_submitted';
    case RefundRequested = 'refund_requested';
    case StoreRegistered = 'store_registered';
    case SupportTicket = 'support_ticket';
    case DailySummary = 'daily_summary';
    /** The AI paused itself after failures in a row (bell only). */
    case AiPaused = 'ai_paused';

    /** The permission a staff member needs to get it (the owner gets every store event). */
    public function permission(): string
    {
        return match ($this) {
            self::NewOrder, self::ShipmentProblem, self::CustomerReply => 'orders.view',
            self::LowStock => 'products.view',
            self::ImportDone => 'products.import',
            self::PaymentReceipt => 'orders.payments',
            self::SupportReply => 'support.use',
            self::DomainReady => 'domains.view',
            self::AiLowBalance => 'ai_wallet.view',
            self::MailboxFailed => 'emails.view',
            default => 'billing.view',
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
