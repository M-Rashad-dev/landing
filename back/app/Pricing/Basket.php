<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Enums\PromotionTarget;

/**
 * The priced items of one order as discount codes and shipping offers see them
 * (amounts in cents, after each product's own offer).
 */
final readonly class Basket
{
    /** @param list<array{product_id: int, categories: list<int>, quantity: int, total: int, offer: bool}> $items */
    public function __construct(public array $items) {}

    /**
     * The items a promotion covers.
     *
     * @param  list<int>  $productIds  for PromotionTarget::Products
     * @param  list<int>  $categoryIds  for PromotionTarget::Categories (an item matches through any of its categories or their parents)
     */
    public function covered(PromotionTarget $target, array $productIds, array $categoryIds): self
    {
        return new self(array_values(array_filter($this->items, fn (array $item): bool => match ($target) {
            PromotionTarget::All => true,
            PromotionTarget::Products => in_array($item['product_id'], $productIds, true),
            PromotionTarget::Categories => array_intersect($item['categories'], $categoryIds) !== [],
        })));
    }

    public function isEmpty(): bool
    {
        return $this->items === [];
    }

    public function quantity(): int
    {
        return array_sum(array_column($this->items, 'quantity'));
    }

    public function total(): int
    {
        return array_sum(array_column($this->items, 'total'));
    }

    public function hasOffer(): bool
    {
        return in_array(true, array_column($this->items, 'offer'), true);
    }

    /** @return list<int> */
    public function productIds(): array
    {
        return array_column($this->items, 'product_id');
    }
}
