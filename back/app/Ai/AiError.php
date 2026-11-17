<?php

declare(strict_types=1);

namespace App\Ai;

use RuntimeException;

/** The provider refused or couldn't be reached (the message is for the logs, never for merchants). */
final class AiError extends RuntimeException
{
    public function __construct(string $message, public readonly ?int $status = null)
    {
        parent::__construct($message);
    }
}
