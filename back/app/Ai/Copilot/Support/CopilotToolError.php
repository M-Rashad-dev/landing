<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Support;

use RuntimeException;

/** A mistake in a tool call the model can fix (unknown filter, bad value…): it gets the message back as the result. */
class CopilotToolError extends RuntimeException {}
