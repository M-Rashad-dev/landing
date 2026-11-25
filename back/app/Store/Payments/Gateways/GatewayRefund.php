<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

/** A refund asked from the gateway: done (the money is on its way back), pending (the gateway is processing), failed. */
final readonly class GatewayRefund
{
    public const DONE = 'done';

    public const PENDING = 'pending';

    public const FAILED = 'failed';

    public function __construct(public string $state, public ?string $reference = null) {}

    /**
     * From a gateway's own status word.
     *
     * @param  list<string>  $done
     * @param  list<string>  $pending
     */
    public static function from(string $status, ?string $reference, array $done, array $pending): self
    {
        $status = strtolower($status);

        return new self(in_array($status, $done, true) ? self::DONE : (in_array($status, $pending, true) ? self::PENDING : self::FAILED), $reference);
    }
}
