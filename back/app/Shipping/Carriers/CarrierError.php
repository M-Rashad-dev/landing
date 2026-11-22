<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use RuntimeException;

/** The carrier refused or couldn't be reached. The message is for the merchant (Arabic, the carrier's reason). */
final class CarrierError extends RuntimeException
{
    /** @param bool $auth the merchant's key is wrong or was revoked */
    public function __construct(string $message, public readonly bool $auth = false, public readonly ?string $carrierCode = null)
    {
        parent::__construct($message);
    }
}
