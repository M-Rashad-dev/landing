<?php

declare(strict_types=1);

namespace App\Analytics;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ProfitSetting;
use App\Models\ShippingCompany;
use App\Models\ShippingCompanyRate;
use App\Store\Stock;
use App\Support\Money;

/**
 * What an order costs the store, snapshotted when it is placed (later price / cost edits never rewrite it): each
 * line's unit cost, the carrier's real fee and return fee, its cash-collection cut, packaging. And the profit an
 * order makes from those numbers.
 */
final class OrderCosts
{
    public function __construct(private readonly Stock $stock) {}

    /**
     * The unit cost of a product for these choices (the combination's own cost first), in cents; null = not set.
     *
     * @param  list<array{option_id: int, value_id: int}>  $selected
     */
    public function unitCost(Product $product, array $selected = []): ?int
    {
        if ($selected !== [] && $product->stock_mode === Product::STOCK_VARIANT) {
            $variantCost = ProductVariant::query()->where('product_id', $product->id)->where('combination_key', $this->stock->keyFor($product, $selected))->value('cost');
            if ($variantCost !== null) {
                return Money::toCents((string) $variantCost);
            }
        }

        return $product->cost === null ? null : Money::toCents((string) $product->cost);
    }

    /** @param list<array{option_id: int, value_id: int}> $selected */
    public function unitCostDecimal(Product $product, array $selected = []): ?string
    {
        $cents = $this->unitCost($product, $selected);

        return $cents === null ? null : Money::toDecimal($cents);
    }

    /** The order-level costs (call once the order and its lines exist). */
    public function snapshot(Order $order): void
    {
        $shippingCost = $returnCost = $codFee = null;
        $company = $order->shipping_company_id === null ? null : ShippingCompany::query()->find($order->shipping_company_id);
        if ($company !== null) {
            $rate = $order->governorate === null ? null : ShippingCompanyRate::query()->where('shipping_company_id', $company->id)->where('governorate', $order->governorate)->first();
            // Not set: the carrier is taken to charge what the customer was quoted before any shipping offer.
            $base = Money::toCents((string) $order->shipping_fee) + Money::toCents((string) $order->shipping_discount);
            $cost = $rate?->cost ?? $company->default_cost;
            $shippingCost = $cost === null ? $base : Money::toCents((string) $cost);
            $returnCost = $company->return_cost === null ? $shippingCost : Money::toCents((string) $company->return_cost);
            if (! $order->isPrepaid() && $company->cod_fee_percent !== null) {
                $codFee = (int) round(Money::toCents((string) $order->total) * (float) $company->cod_fee_percent / 100);
            }
        }

        $order->forceFill([
            'shipping_cost' => $shippingCost === null ? null : Money::toDecimal($shippingCost),
            'return_cost' => $returnCost === null ? null : Money::toDecimal($returnCost),
            'cod_fee' => $codFee === null ? null : Money::toDecimal($codFee),
            'packaging_cost' => ProfitSetting::current()->packaging_cost,
        ])->save();
    }

    /**
     * One order's money (cents): what came in, what it cost, and the profit; a returned / damaged order is a loss.
     * cost_known false when a line has no unit cost (its cost counts as 0 then).
     *
     * @return array{revenue: int, product_cost: int, shipping_cost: int, cod_fee: int, packaging: int, loss: int, profit: int, cost_known: bool}
     */
    public function profit(Order $order): array
    {
        $order->loadMissing('items');
        $productCost = 0;
        $known = true;
        foreach ($order->items as $item) {
            /** @var OrderItem $item */
            if ($item->unit_cost === null) {
                $known = false;

                continue;
            }
            $productCost += Money::toCents((string) $item->unit_cost) * $item->quantity;
        }
        $shipping = $order->shipping_cost === null ? 0 : Money::toCents((string) $order->shipping_cost);
        $packaging = $order->packaging_cost === null ? 0 : Money::toCents((string) $order->packaging_cost);
        $cod = $order->cod_fee === null ? 0 : Money::toCents((string) $order->cod_fee);

        if ($order->status === OrderStatus::Returned || $order->status === OrderStatus::Damaged) {
            // Shipped both ways for nothing; a damaged parcel loses its goods too.
            $return = $order->return_cost === null ? $shipping : Money::toCents((string) $order->return_cost);
            $loss = $shipping + $return + $packaging + ($order->status === OrderStatus::Damaged ? $productCost : 0);

            return ['revenue' => 0, 'product_cost' => $order->status === OrderStatus::Damaged ? $productCost : 0, 'shipping_cost' => $shipping + $return, 'cod_fee' => 0, 'packaging' => $packaging, 'loss' => $loss, 'profit' => -$loss, 'cost_known' => $known];
        }
        if ($order->status->isDismissed()) {
            return ['revenue' => 0, 'product_cost' => 0, 'shipping_cost' => 0, 'cod_fee' => 0, 'packaging' => 0, 'loss' => 0, 'profit' => 0, 'cost_known' => true];
        }

        $revenue = Money::toCents((string) $order->total);

        return [
            'revenue' => $revenue,
            'product_cost' => $productCost,
            'shipping_cost' => $shipping,
            'cod_fee' => $cod,
            'packaging' => $packaging,
            'loss' => 0,
            'profit' => $revenue - $productCost - $shipping - $cod - $packaging,
            'cost_known' => $known,
        ];
    }
}
