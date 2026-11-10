<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Product stock in three modes: unlimited (default), one number for the product, or one per
 * combination of required options. Orders take stock inside their transaction (rows locked);
 * cancelled, fake and returned orders give it back once. Every change is a stock movement.
 */
final class Stock
{
    /**
     * Units available now for these choices; null = unlimited.
     *
     * @param  list<array{option_id: int, value_id: int}>  $selected
     */
    public function available(Product $product, array $selected): ?int
    {
        return match ($product->stock_mode) {
            Product::STOCK_PRODUCT => max(0, (int) $product->stock),
            Product::STOCK_VARIANT => max(0, (int) ($this->variant($product, $selected)?->stock ?? 0)),
            default => null,
        };
    }

    /**
     * The variant key of the chosen values of required options (others don't split stock).
     *
     * @param  list<array{option_id: int, value_id: int}>  $selected
     */
    public function keyFor(Product $product, array $selected): string
    {
        $product->loadMissing('options');
        $required = $product->options->where('is_required', true)->pluck('id')->all();

        return ProductVariant::keyFor(array_column(array_filter($selected, fn (array $s) => in_array($s['option_id'], $required, true)), 'value_id'));
    }

    /**
     * Takes stock for every line of a new order; call inside the order transaction.
     *
     * @param  list<array{product: Product, selected: list<array{option_id: int, value_id: int}>, quantity: int, field: string}>  $lines
     *
     * @throws ValidationException when a line asks for more than is left
     */
    public function take(Order $order, array $lines): void
    {
        foreach ($lines as $line) {
            $product = $line['product'];
            if (! $product->tracksStock()) {
                continue;
            }

            if ($product->stock_mode === Product::STOCK_PRODUCT) {
                $row = Product::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
                $this->ensure((int) $row->stock, $line['quantity'], $line['field']);
                Product::query()->whereKey($product->id)->toBase()->decrement('stock', $line['quantity']);
                $this->log($order, $product->id, null, -$line['quantity'], 'order');

                continue;
            }

            $variant = ProductVariant::query()
                ->where('product_id', $product->id)
                ->where('combination_key', $this->keyFor($product, $line['selected']))
                ->lockForUpdate()
                ->first();
            $this->ensure((int) ($variant?->stock ?? 0), $line['quantity'], $line['field']);
            ProductVariant::query()->whereKey($variant->id)->toBase()->decrement('stock', $line['quantity']);
            $this->log($order, $product->id, $variant->id, -$line['quantity'], 'order');
        }
    }

    /** Gives back what the order still holds (once: movements net to zero afterwards). */
    public function restock(Order $order): void
    {
        $held = StockMovement::query()
            ->where('order_id', $order->id)
            ->selectRaw('product_id, variant_id, sum(`change`) as net')
            ->groupBy('product_id', 'variant_id')
            ->get();

        foreach ($held as $row) {
            $net = (int) $row->getAttribute('net');
            if ($net >= 0) {
                continue;
            }
            $variantId = $row->getAttribute('variant_id');
            if ($variantId !== null) {
                ProductVariant::query()->whereKey($variantId)->toBase()->increment('stock', -$net);
            } else {
                Product::query()->withTrashed()->whereKey($row->getAttribute('product_id'))->toBase()->increment('stock', -$net);
            }
            $this->log($order, (int) $row->getAttribute('product_id'), $variantId === null ? null : (int) $variantId, -$net, 'restock');
        }
    }

    /** Merchant edits in the dashboard are logged too (difference only). */
    public function logManual(int $productId, ?int $variantId, int $change): void
    {
        if ($change !== 0) {
            StockMovement::query()->create(['product_id' => $productId, 'variant_id' => $variantId, 'change' => $change, 'reason' => 'manual']);
        }
    }

    private function ensure(int $left, int $wanted, string $field): void
    {
        if ($wanted > $left) {
            throw ValidationException::withMessages([$field => [$left <= 0 ? __('store.out_of_stock') : __('store.only_left', ['count' => $left])]]);
        }
    }

    private function log(Order $order, int $productId, ?int $variantId, int $change, string $reason): void
    {
        StockMovement::query()->create(['product_id' => $productId, 'variant_id' => $variantId, 'change' => $change, 'reason' => $reason, 'order_id' => $order->id]);
    }

    /** @param list<array{option_id: int, value_id: int}> $selected */
    private function variant(Product $product, array $selected): ?ProductVariant
    {
        if ($product->relationLoaded('variants')) {
            return $product->variants->firstWhere('combination_key', $this->keyFor($product, $selected));
        }

        return ProductVariant::query()->where('product_id', $product->id)->where('combination_key', $this->keyFor($product, $selected))->first();
    }

    /** Units of every combination of the product (for the product page), keyed by combination. @return array<string, int> */
    public function variantStock(Product $product): array
    {
        $product->loadMissing('variants');

        return $product->variants->mapWithKeys(fn (ProductVariant $v) => [$v->combination_key => max(0, $v->stock)])->all();
    }

    /** True when DB::transaction is open (stock must be taken inside the order transaction). */
    public static function inTransaction(): bool
    {
        return DB::transactionLevel() > 0;
    }
}
