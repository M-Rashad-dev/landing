<?php

declare(strict_types=1);

namespace App\Pricing;

use App\Enums\DiscountType;
use App\Enums\OfferType;
use App\Support\Money;

/**
 * Pure arithmetic of section 7.1 (integer cents, half-up rounding). No I/O.
 */
final class PriceMath
{
    /**
     * Total after one offer, or null when the offer does not apply / gives no discount.
     *
     * @param  int  $baseSubtotal  unit price (with option deltas) × quantity
     * @param  int  $productPrice  product price without option deltas
     * @param  int  $deltaSum  sum of selected option deltas for one unit
     * @param  int  $minQuantity  percentage / fixed / gift: smallest quantity it applies to; buy_get: units to buy
     * @param  int|null  $freeQuantity  buy_get: free units per group
     *
     * A gift offer gives no discount: it returns the subtotal unchanged when it applies.
     */
    public static function offerTotal(
        OfferType $type,
        int $value,
        ?int $bundleQuantity,
        int $bundlePrice,
        int $baseSubtotal,
        int $quantity,
        int $productPrice,
        int $deltaSum,
        int $minQuantity = 1,
        ?int $freeQuantity = null,
    ): ?int {
        if ($type->usesMinQuantity() && $type !== OfferType::BuyGet && $quantity < max(1, $minQuantity)) {
            return null;
        }
        if ($type === OfferType::Gift) {
            return $baseSubtotal;
        }

        $total = match ($type) {
            // value = percent × 100 (cents representation of e.g. "25.00")
            OfferType::Percentage => $baseSubtotal - Money::mulDivRound($baseSubtotal, $value, 10000),
            // value = discount per unit
            OfferType::Fixed => $baseSubtotal - min($value * $quantity, $baseSubtotal),
            OfferType::Bundle => self::bundleTotal($bundleQuantity, $bundlePrice, $quantity, $productPrice, $deltaSum),
            OfferType::BuyGet => self::buyGetTotal(max(1, $minQuantity), $freeQuantity ?? 0, $quantity, $productPrice + $deltaSum),
            OfferType::Gift => $baseSubtotal,
        };

        if ($total === null || $total >= $baseSubtotal) {
            return null;
        }

        return max(0, $total);
    }

    private static function bundleTotal(?int $bundleQuantity, int $bundlePrice, int $quantity, int $productPrice, int $deltaSum): ?int
    {
        if ($bundleQuantity === null || $bundleQuantity < 2 || $quantity < $bundleQuantity) {
            return null;
        }

        // A bundle that became unprofitable after a price change is ignored.
        if ($bundlePrice >= $productPrice * $bundleQuantity) {
            return null;
        }

        $groups = intdiv($quantity, $bundleQuantity);
        $rest = $quantity % $bundleQuantity;

        return $groups * $bundlePrice + $rest * $productPrice + $deltaSum * $quantity;
    }

    /** Every full group of buy + free units pays for the bought units only (free units are fully free). */
    private static function buyGetTotal(int $buy, int $free, int $quantity, int $unitPrice): ?int
    {
        if ($free < 1) {
            return null;
        }
        $freeUnits = intdiv($quantity, $buy + $free) * $free;

        return $freeUnits === 0 ? null : ($quantity - $freeUnits) * $unitPrice;
    }

    /**
     * Pick the offer applied automatically: the merchant's priority first, then the lowest total
     * for the customer (`rank` when given: a gift counts its product's value), then the oldest id.
     *
     * @param  list<array{id: int, priority: int, total: int, rank?: int}>  $candidates
     * @return array{id: int, priority: int, total: int, rank?: int}|null
     */
    public static function bestOffer(array $candidates): ?array
    {
        if ($candidates === []) {
            return null;
        }

        usort($candidates, fn (array $a, array $b) => [-$a['priority'], $a['rank'] ?? $a['total'], $a['id']] <=> [-$b['priority'], $b['rank'] ?? $b['total'], $b['id']]);

        return $candidates[0];
    }

    /** Discount of a code on the amount after the offer. */
    public static function codeDiscount(DiscountType $type, int $value, ?int $maxDiscount, int $afterOffer): int
    {
        $discount = match ($type) {
            DiscountType::Percentage => Money::mulDivRound($afterOffer, $value, 10000),
            DiscountType::Fixed => min($value, $afterOffer),
            DiscountType::FreeShipping => 0,
        };

        if ($type === DiscountType::Percentage && $maxDiscount !== null) {
            $discount = min($discount, $maxDiscount);
        }

        return max(0, min($discount, $afterOffer));
    }
}
