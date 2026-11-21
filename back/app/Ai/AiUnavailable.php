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

    /** The provider refused the platform's own account (no credit, bad key): ours to fix, the admins are alerted. */
    public const PROVIDER = 'provider';

    public function __construct(public readonly string $reason)
    {
        parent::__construct("AI unavailable: {$reason}");
    }

    /** Why, for the merchant (never the provider's own words). */
    public function reasonText(): string
    {
        return (string) __('ai.unavailable_reasons.'.$this->reason);
    }

    /** Asking again a moment later may work (a provider hiccup); the other reasons stay until someone acts. */
    public function retryable(): bool
    {
        return $this->reason === self::FAILED;
    }
}
