<?php

declare(strict_types=1);

namespace App\Actions\Products;

use App\Jobs\RevalidateTenantHosts;
use App\Models\Product;
use App\Store\ProductCategories;
use App\Store\Stock;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The few fields the product card edits in place. Stock kept per option combination
 * can only change from the product page (the card shows it read-only).
 */
final class QuickUpdateProduct
{
    public function __construct(private readonly ProductCategories $categories, private readonly Stock $stock) {}

    /** @param array<string, mixed> $data validated QuickProductRequest data */
    public function handle(Product $product, array $data): Product
    {
        $touchesStock = array_key_exists('stock', $data) || array_key_exists('stock_mode', $data);
        if ($touchesStock && $product->stock_mode === Product::STOCK_VARIANT) {
            throw ValidationException::withMessages(['stock' => [__('store.stock_from_variants')]]);
        }

        DB::transaction(function () use ($product, $data): void {
            if (array_key_exists('name', $data)) {
                $product->name = (string) $data['name'];
            }
            if (array_key_exists('price', $data)) {
                $product->price = Money::toDecimal(Money::toCents((string) $data['price']));
            }
            if (array_key_exists('stock_mode', $data)) {
                $product->stock_mode = (string) $data['stock_mode'];
            }
            // Movement log: the change against what was tracked before (nothing when it was unlimited).
            $before = $product->getOriginal('stock_mode') === Product::STOCK_PRODUCT ? (int) $product->getOriginal('stock') : 0;
            if ($product->stock_mode === Product::STOCK_PRODUCT && array_key_exists('stock', $data)) {
                $product->stock = (int) ($data['stock'] ?? 0);
            }
            if ($product->stock_mode === Product::STOCK_PRODUCT && $product->stock === null) {
                $product->stock = 0;
            }
            $product->save();
            if ($product->stock_mode === Product::STOCK_PRODUCT && array_key_exists('stock', $data) && $product->stock !== $before) {
                $this->stock->logManual($product->id, null, $product->stock - $before);
            }

            if (array_key_exists('category_ids', $data) || array_key_exists('primary_category_id', $data)) {
                $this->categories->sync(
                    $product,
                    array_key_exists('category_ids', $data) ? array_values(array_map('intval', $data['category_ids'] ?? [])) : null,
                    isset($data['primary_category_id']) ? (int) $data['primary_category_id'] : null,
                    array_key_exists('primary_category_id', $data),
                );
            }
        });

        RevalidateTenantHosts::dispatch((int) Tenancy::id())->afterCommit();

        return $product;
    }
}
