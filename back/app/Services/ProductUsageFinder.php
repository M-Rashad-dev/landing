<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\LandingPage;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

/** Where a product is referenced (inside the product's tenant). */
final class ProductUsageFinder
{
    /** Pages (not deleted) linked to the product. @return list<array{id: int, title: string}> */
    public function pages(Product $product): array
    {
        return LandingPage::query()
            ->where('product_id', $product->id)
            ->get(['id', 'title'])
            ->map(fn (LandingPage $page) => ['id' => $page->id, 'title' => $page->title])
            ->all();
    }

    /** Remove the product from offers and discount codes. */
    public function unlinkPromotions(Product $product): void
    {
        DB::table('offer_products')->where('tenant_id', $product->tenant_id)->where('product_id', $product->id)->delete();
        DB::table('discount_code_products')->where('tenant_id', $product->tenant_id)->where('product_id', $product->id)->delete();
    }
}
