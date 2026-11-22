<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use App\Enums\ShipmentState;
use Carbon\CarbonImmutable;

/** Where a shipment is, as the carrier says it (state null: a carrier state we don't act on). */
final class CarrierUpdate
{
    public function __construct(
        public readonly string $trackingNumber,
        public readonly ?ShipmentState $state,
        public readonly ?int $code,
        public readonly ?string $label,
        public readonly CarbonImmutable $at,
        public readonly ?string $note = null,
        public readonly ?int $attempts = null,
    ) {}
}
