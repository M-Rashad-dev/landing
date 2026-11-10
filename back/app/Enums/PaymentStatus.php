<?php

declare(strict_types=1);

namespace App\Enums;

enum PaymentStatus: string
{
    case PendingReview = 'pending_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
}
