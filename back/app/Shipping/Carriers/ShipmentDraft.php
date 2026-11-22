<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

/** Everything a carrier needs to create one shipment (built from an order by ShipOrder). Money in cents. */
final class ShipmentDraft
{
    /** @param list<string> $images absolute product photo URLs (opening the package needs them at some carriers) */
    public function __construct(
        public readonly string $reference,
        public readonly string $receiverName,
        public readonly string $phone,
        public readonly ?string $phone2,
        public readonly ?string $email,
        public readonly string $governorate,
        public readonly ?string $city,
        public readonly string $address,
        public readonly ?string $districtId,
        public readonly int $cod,
        public readonly int $itemsCount,
        public readonly string $description,
        public readonly ?string $notes,
        public readonly bool $allowOpen,
        public readonly array $images,
        public readonly ?string $locationId,
        public readonly string $packageType,
        public readonly string $size,
        public readonly string $webhookUrl,
        public readonly string $webhookSecret,
    ) {}
}
