<?php

declare(strict_types=1);

namespace App\Actions\Products;

use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Services\ProductUsageFinder;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deletes a product that no live page uses, and unlinks it from offers
 * and discount codes (orders keep their own snapshot).
 */
final class DeleteProduct
{
    public function __construct(private readonly ProductUsageFinder $usages) {}

    public function handle(Product $product): void
    {
        $pages = $this->usages->pages($product);

        if ($pages !== []) {
            throw ApiException::conflict('product_in_use', __('products.in_use'), ['pages' => $pages]);
        }

        DB::transaction(function () use ($product): void {
            $this->usages->unlinkPromotions($product);
            $product->delete();
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();
    }
}
