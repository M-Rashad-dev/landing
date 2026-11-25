<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

/**
 * A checkout as the gateway has it now. state: paid, waiting (paid later at a kiosk), open (not finished), failed,
 * expired. amountCents is what was paid (null when the gateway doesn't say).
 */
final readonly class GatewayResult
{
    public const PAID = 'paid';

    public const WAITING = 'waiting';

    public const OPEN = 'open';

    public const FAILED = 'failed';

    public const EXPIRED = 'expired';

    public function __construct(
        public string $state,
        public ?int $amountCents = null,
        public ?string $paymentRef = null,
        public ?string $method = null,
        public ?bool $livemode = null,
        public string $currency = 'EGP',
    ) {}
}
