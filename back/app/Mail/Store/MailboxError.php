<?php

declare(strict_types=1);

namespace App\Mail\Store;

use RuntimeException;
use Throwable;

/** The merchant's mailbox refused or couldn't be reached; the message is for the merchant (Arabic). */
final class MailboxError extends RuntimeException
{
    public static function from(Throwable $e): self
    {
        $raw = $e->getMessage();
        $key = match (true) {
            preg_match('/\b535\b|\b534\b|authenticat|credentials|password|username/i', $raw) === 1 => 'auth',
            preg_match('/could not be established|timed out|connection refused|getaddrinfo|ssl|tls|certificate/i', $raw) === 1 => 'connect',
            preg_match('/\b55[0-4]\b|sender|from address|relay/i', $raw) === 1 => 'sender',
            default => 'other',
        };

        return new self((string) __('store_mail.errors.'.$key, ['reason' => mb_substr(trim($raw), 0, 160)]), 0, $e);
    }
}
