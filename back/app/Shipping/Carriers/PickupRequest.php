<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

/** A courier visit to the store's pickup location. */
final class PickupRequest
{
    public function __construct(
        public readonly string $date,
        public readonly ?string $locationId,
        public readonly int $parcels,
        public readonly string $contactName,
        public readonly ?string $contactPhone,
        public readonly ?string $notes = null,
    ) {}
}
