<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

/** Validation failed for records the model prepared: the per-field (or per-item) messages go back to it. */
final class CopilotValidationError extends CopilotToolError
{
    /** @param array<string, mixed> $fields */
    public function __construct(string $message, public readonly array $fields)
    {
        parent::__construct($message);
    }
}
