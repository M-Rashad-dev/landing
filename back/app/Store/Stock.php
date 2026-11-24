<?php

declare(strict_types=1);

namespace App\Store;

use App\Models\Order;
use App\Models\Product;
use App\Models\ProductCode;
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
        // A codes product: the uses left of its entries for these choices.
        if ($product->deliversCodes()) {
            return $this->codesLeft($product, $this->keyFor($product, $selected));
        }

        return match ($product->stock_mode) {
            Product::STOCK_PRODUCT => max(0, (int) $product->stock),
            Product::STOCK_VARIANT => max(0, (int) ($this->variant($product, $selected)?->stock ?? 0)),
            default => null,
        };
    }

    /** Uses left of a codes product's entries for one option combination ("" without options). */
    public function codesLeft(Product $product, string $key): int
    {
        return (int) ProductCode::query()->where('product_id', $product->id)->where('combination_key', $key)->sum('uses_left');
    }

    /** Uses left per option combination of a codes product. @return array<string, int> */
    public function codeStock(Product $product): array
    {
        return ProductCode::query()->where('product_id', $product->id)->where('uses_left', '>', 0)
            ->selectRaw('combination_key, sum(uses_left) as left_count')->groupBy('combination_key')
            ->pluck('left_count', 'combination_key')->map(fn ($n) => (int) $n)->all();
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
     * @return list<array{product_id: int, name: string, left: int}> what went down to its low-stock mark with this order
     *
     * @throws ValidationException when a line asks for more than is left
     */
    public function take(Order $order, array $lines): array
    {
        $low = [];
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
                $this->crossed($low, $product, (int) $row->stock, $line['quantity']);

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
            $this->crossed($low, $product, (int) $variant->stock, $line['quantity']);
        }

        return $low;
    }

    /**
     * Notes a product whose stock went from above its low-stock mark to at or under it.
     *
     * @param  list<array{product_id: int, name: string, left: int}>  $low
     */
    private function crossed(array &$low, Product $product, int $before, int $taken): void
    {
        $mark = $product->low_stock_threshold ?? ProductList::LOW_STOCK_DEFAULT;
        $after = $before - $taken;
        if ($before > $mark && $after <= $mark) {
            $low[] = ['product_id' => $product->id, 'name' => (string) $product->name, 'left' => $after];
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

    /**
     * Gives back some units of some lines (a refund with returned items), never more than the order still holds for
     * that product / combination. Returns the units given back.
     *
     * @param  array<int, int>  $quantities  order item id => units
     */
    public function restockItems(Order $order, array $quantities): int
    {
        // Each line's stock movement (taken in the lines' order): it tells the combination the line took.
        $items = $order->items()->orderBy('id')->get(['id', 'product_id', 'quantity']);
        $variantOf = [];
        $taken = StockMovement::query()->where('order_id', $order->id)->where('reason', 'order')->orderBy('id')->get(['product_id', 'variant_id', 'change']);
        foreach ($taken as $movement) {
            foreach ($items as $item) {
                if (! array_key_exists($item->id, $variantOf) && (int) $item->product_id === (int) $movement->product_id && (int) $item->quantity === -(int) $movement->change) {
                    $variantOf[$item->id] = $movement->variant_id;

                    break;
                }
            }
        }

        $given = 0;
        foreach ($items as $item) {
            if (! isset($quantities[$item->id]) || ! array_key_exists($item->id, $variantOf)) {
                continue;
            }
            $variantId = $variantOf[$item->id];
            $held = -(int) StockMovement::query()->where('order_id', $order->id)->where('product_id', $item->product_id)
                ->when($variantId === null, fn ($q) => $q->whereNull('variant_id'), fn ($q) => $q->where('variant_id', $variantId))
                ->sum('change');
            $units = min($held, max(0, $quantities[$item->id] ?? 0));
            if ($units <= 0) {
                continue;
            }
            if ($variantId !== null) {
                ProductVariant::query()->whereKey($variantId)->toBase()->increment('stock', $units);
            } else {
                Product::query()->withTrashed()->whereKey($item->product_id)->toBase()->increment('stock', $units);
            }
            $this->log($order, (int) $item->product_id, $variantId === null ? null : (int) $variantId, $units, 'restock');
            $given += $units;
        }

        return $given;
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
