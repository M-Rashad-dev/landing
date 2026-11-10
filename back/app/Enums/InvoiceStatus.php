<?php

declare(strict_types=1);

namespace App\Enums;

enum InvoiceStatus: string
{
    /** Waiting for a payment (or a new receipt after a rejection). */
    case Open = 'open';
    /** A receipt was sent and waits for the admin. */
    case PendingReview = 'pending_review';
    case Paid = 'paid';
    /** Replaced by a newer invoice or cancelled by the merchant. */
    case Cancelled = 'cancelled';
    /** Open for too long without a receipt (prices may have changed). */
    case Expired = 'expired';
    case Refunded = 'refunded';

    /** A receipt can be sent now. */
    public function acceptsPayment(): bool
    {
        return $this === self::Open;
    }
}
