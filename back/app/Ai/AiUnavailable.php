<?php

declare(strict_types=1);

namespace App\Ai;

use RuntimeException;

/**
 * The AI won't be asked right now, on purpose: the feature is off, the keys are missing, today's
 * limit is reached, or it is paused after failures. Features fall back (support → a person).
 */
final class AiUnavailable extends RuntimeException
{
    public const OFF = 'off';

    public const NOT_CONFIGURED = 'not_configured';

    public const DAILY_LIMIT = 'daily_limit';

    public const PAUSED = 'paused';

    public const FAILED = 'failed';

    public function __construct(public readonly string $reason)
    {
        parent::__construct("AI unavailable: {$reason}");
    }
}
