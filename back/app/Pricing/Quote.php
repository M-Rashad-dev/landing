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
        /** Delivery (fee included in $total; null fee = shipping off or governorate not chosen yet). */
        public ShippingQuote $delivery = new ShippingQuote,
        /** Free product of a gift offer: product_id, name, price (cents, its regular price). */
        public ?array $gift = null,
        /** Why the offer the customer chose does not apply yet (e.g. needs a bigger quantity). */
        public ?string $offerError = null,
    ) {}

    /** Products after offer and code, before delivery. */
    public function itemsTotal(): int
    {
        return $this->total - ($this->delivery->fee ?? 0);
    }

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
            'gift' => $this->gift === null ? null : ['product_id' => $this->gift['product_id'], 'name' => $this->gift['name'], 'value' => Money::toFloat($this->gift['price'])],
            'offer_error' => $this->offerError,
            'subtotal_after_offer' => Money::toFloat($this->subtotalAfterOffer),
            'code' => $this->code === null ? null : [
                'code' => $this->code->code,
                'discount' => Money::toFloat($this->codeDiscount),
            ],
            'code_error' => $this->codeError,
            'items_total' => Money::toFloat($this->itemsTotal()),
            ...$this->delivery->toArray(),
            'total' => Money::toFloat($this->total),
        ];
    }
}
