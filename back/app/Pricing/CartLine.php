<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Enums\OfferType;
use App\Models\Product;
use App\Support\Money;

/** One priced line of a store cart (cents). */
final readonly class CartLine
{
    /**
     * @param  array{id: int, name: string, type: OfferType}|null  $offer
     * @param  list<array{option_id: int, option: string, value_id: int, value: string, price_delta: int}>  $selected
     * @param  array{product_id: int, name: string, price: int}|null  $gift
     */
    public function __construct(
        public Product $product,
        public int $quantity,
        public int $unitPrice,
        public int $base,
        public ?array $offer,
        public int $offerDiscount,
        public int $afterOffer,
        public array $selected,
        public ?array $gift,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'product_id' => $this->product->id,
            'name' => $this->product->name,
            'quantity' => $this->quantity,
            'unit_price' => Money::toFloat($this->unitPrice),
            'subtotal' => Money::toFloat($this->base),
            'offer' => $this->offer === null ? null : ['id' => $this->offer['id'], 'name' => $this->offer['name']],
            'offer_discount' => Money::toFloat($this->offerDiscount),
            'total' => Money::toFloat($this->afterOffer),
            'options' => array_map(fn (array $v) => ['option' => $v['option'], 'value' => $v['value'], 'price_delta' => Money::toFloat($v['price_delta'])], $this->selected),
            'gift' => $this->gift === null ? null : ['product_id' => $this->gift['product_id'], 'name' => $this->gift['name']],
        ];
    }
}
