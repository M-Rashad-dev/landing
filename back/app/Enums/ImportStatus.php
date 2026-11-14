<?php

declare(strict_types=1);

namespace App\Enums;

/** Where a product import is: waiting for its column mapping, in the queue, done or stopped. */
enum ImportStatus: string
{
    case Uploaded = 'uploaded';
    case Queued = 'queued';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    /** Still running in the queue (one at a time per store). */
    public function isActive(): bool
    {
        return $this === self::Queued || $this === self::Processing;
    }

    public function isFinished(): bool
    {
        return $this === self::Completed || $this === self::Failed || $this === self::Cancelled;
    }
}
