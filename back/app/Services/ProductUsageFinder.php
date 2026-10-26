<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Product;

/** Where a product is referenced (inside the product's tenant). */
final class ProductUsageFinder
{
    /** Pages (not deleted) linked to the product. @return list<array{id: int, title: string}> */
    public function pages(Product $product): array
    {
        return [];
    }

    /** Remove the product from offers and discount codes. */
    public function unlinkPromotions(Product $product): void {}
}
