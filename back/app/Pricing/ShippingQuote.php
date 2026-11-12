<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Support\Money;

/**
 * Delivery part of a quote (cents). fee null = shipping off or no governorate yet.
 * Options = every active company that delivers to the governorate, with its fee after offers.
 */
final readonly class ShippingQuote
{
    /**
     * @param  array{id: int, name: string, days_min: int|null, days_max: int|null}|null  $company
     * @param  array{id: int, name: string}|null  $offer
     * @param  list<array{id: int, name: string, logo: array<string, mixed>|null, days_min: int|null, days_max: int|null, original: int, fee: int, offer: string|null}>  $options
     */
    public function __construct(
        public ?int $fee = null,
        public ?int $original = null,
        public bool $available = true,
        public ?array $company = null,
        public ?array $offer = null,
        public bool $byCode = false,
        public array $options = [],
        /** The company the customer chose does not deliver to this governorate. */
        public bool $companyMismatch = false,
    ) {}

    /** Saved by a shipping offer or a free-shipping code. */
    public function discount(): int
    {
        return $this->fee === null || $this->original === null ? 0 : $this->original - $this->fee;
    }

    public function free(): bool
    {
        return $this->fee === 0 && $this->discount() > 0;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'shipping' => $this->fee === null ? null : Money::toFloat($this->fee),
            'shipping_original' => $this->original === null ? null : Money::toFloat($this->original),
            'shipping_free' => $this->free(),
            'shipping_available' => $this->available,
            'shipping_company' => $this->company,
            'shipping_offer' => $this->offer,
            'shipping_by_code' => $this->byCode,
            'shipping_options' => array_map(fn (array $o) => [
                'id' => $o['id'],
                'name' => $o['name'],
                'logo' => $o['logo'],
                'days_min' => $o['days_min'],
                'days_max' => $o['days_max'],
                'original' => Money::toFloat($o['original']),
                'fee' => Money::toFloat($o['fee']),
                'offer' => $o['offer'],
            ], $this->options),
        ];
    }
}
