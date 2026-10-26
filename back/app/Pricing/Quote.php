<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Enums\OfferType;
use App\Models\DiscountCode;
use App\Support\Money;

/**
 * Result of PriceCalculator::quote(). All amounts are integer cents; toArray()
 * is the only place they become decimals.
 */
final readonly class Quote
{
    /**
     * @param  list<array{option_id: int, option: string, value_id: int, value: string, price_delta: int}>  $selectedValues
     * @param  array{id: int, name: string, type: OfferType}|null  $offer
     */
    public function __construct(
        public int $unitPrice,
        public int $quantity,
        public int $baseSubtotal,
        public ?array $offer,
        public int $offerDiscount,
        public int $subtotalAfterOffer,
        public ?DiscountCode $code,
        public int $codeDiscount,
        public ?string $codeError,
        public int $total,
        public array $selectedValues,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'currency' => 'EGP',
            'unit_price' => Money::toFloat($this->unitPrice),
            'quantity' => $this->quantity,
            'base_subtotal' => Money::toFloat($this->baseSubtotal),
            'offer' => $this->offer === null ? null : [
                'id' => $this->offer['id'],
                'name' => $this->offer['name'],
                'type' => $this->offer['type']->value,
                'discount' => Money::toFloat($this->offerDiscount),
            ],
            'subtotal_after_offer' => Money::toFloat($this->subtotalAfterOffer),
            'code' => $this->code === null ? null : [
                'code' => $this->code->code,
                'discount' => Money::toFloat($this->codeDiscount),
            ],
            'code_error' => $this->codeError,
            'total' => Money::toFloat($this->total),
        ];
    }
}
