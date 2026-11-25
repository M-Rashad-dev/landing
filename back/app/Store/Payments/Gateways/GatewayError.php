<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

use RuntimeException;

/** A gateway refused or couldn't be reached. The message is for the merchant (Arabic); auth = the credentials are wrong. */
final class GatewayError extends RuntimeException
{
    public function __construct(string $message, public readonly bool $auth = false, public readonly ?string $detail = null)
    {
        parent::__construct($message);
    }
}
