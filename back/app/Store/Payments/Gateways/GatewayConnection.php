<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

/** What connecting kept: the credentials to store (encrypted) and whether they are test or live keys. */
final readonly class GatewayConnection
{
    /** @param  array<string, string>  $credentials */
    public function __construct(public array $credentials, public string $mode) {}
}
