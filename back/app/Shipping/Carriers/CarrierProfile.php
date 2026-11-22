<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

/** What a verified carrier account looks like: a name to show and its pickup locations. */
final class CarrierProfile
{
    /** @param list<array{id: string, name: string, is_default: bool}> $locations */
    public function __construct(
        public readonly ?string $accountName,
        public readonly array $locations,
    ) {}

    public function defaultLocation(): ?string
    {
        foreach ($this->locations as $location) {
            if ($location['is_default']) {
                return $location['id'];
            }
        }

        return $this->locations[0]['id'] ?? null;
    }
}
