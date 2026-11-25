<?php

declare(strict_types=1);

namespace App\Store\Payments\Gateways;

/** One order to pay at the gateway (amount in piasters, EGP). */
final readonly class GatewayCheckout
{
    public function __construct(
        public string $reference,
        public int $amountCents,
        public string $description,
        public string $customerName,
        public string $customerPhone,
        public ?string $customerEmail,
        public string $returnUrl,
        public string $webhookUrl,
        public ?string $city = null,
        public ?string $address = null,
    ) {}
}
