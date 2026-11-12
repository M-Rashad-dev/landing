<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Models\DiscountCode;
use App\Support\Money;

/** A priced store cart: lines after their offers, the code on the lines it covers, shipping (cents). */
final readonly class CartQuote
{
    /** @param list<CartLine> $lines */
    public function __construct(
        public array $lines,
        public int $subtotal,
        public ?DiscountCode $code,
        public int $codeDiscount,
        public ?string $codeError,
        public ShippingQuote $delivery,
        public int $total,
    ) {}

    public function itemsCount(): int
    {
        return array_sum(array_map(fn (CartLine $l) => $l->quantity, $this->lines));
    }

    public function offerDiscount(): int
    {
        return array_sum(array_map(fn (CartLine $l) => $l->offerDiscount, $this->lines));
    }

    public function base(): int
    {
        return array_sum(array_map(fn (CartLine $l) => $l->base, $this->lines));
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'lines' => array_map(fn (CartLine $l) => $l->toArray(), $this->lines),
            'items_count' => $this->itemsCount(),
            'subtotal' => Money::toFloat($this->base()),
            'offer_discount' => Money::toFloat($this->offerDiscount()),
            'code' => $this->code?->code,
            'code_discount' => Money::toFloat($this->codeDiscount),
            'code_error' => $this->codeError,
            ...$this->delivery->toArray(),
            'total' => Money::toFloat($this->total),
        ];
    }
}
