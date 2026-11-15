<?php

declare(strict_types=1);

namespace App\Messaging\WhatsApp;

use RuntimeException;

/** Meta refused the call (errorCode = Meta's code, e.g. 131026 "not on WhatsApp") or could not be reached ("network"). */
final class WhatsAppError extends RuntimeException
{
    /** Meta's codes meaning the number can't get WhatsApp messages (not on WhatsApp / not a valid number). */
    private const UNREACHABLE = ['131026', '131030', '133010'];

    public function __construct(public readonly string $errorCode, public readonly string $title)
    {
        parent::__construct("WhatsApp error {$errorCode}: {$title}");
    }

    public function unreachableNumber(): bool
    {
        return in_array($this->errorCode, self::UNREACHABLE, true);
    }
}
