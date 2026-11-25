<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

/** A hosted checkout opened at the gateway: its id there and where to send the customer. */
final readonly class GatewaySession
{
    public function __construct(public ?string $externalId, public string $url) {}
}
