<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

/** A shipment the carrier just created. */
final class CarrierShipment
{
    public function __construct(
        public readonly ?string $externalId,
        public readonly string $trackingNumber,
        public readonly CarrierUpdate $update,
    ) {}
}
