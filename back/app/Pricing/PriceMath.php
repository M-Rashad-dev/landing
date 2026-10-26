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
    ): ?int {
        $total = match ($type) {
            // value = percent × 100 (cents representation of e.g. "25.00")
            OfferType::Percentage => $baseSubtotal - Money::mulDivRound($baseSubtotal, $value, 10000),
            // value = discount per unit
            OfferType::Fixed => $baseSubtotal - min($value * $quantity, $baseSubtotal),
            OfferType::Bundle => self::bundleTotal($bundleQuantity, $bundlePrice, $quantity, $productPrice, $deltaSum),
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

    /**
     * Pick the best offer: lowest total, then highest priority, then oldest id.
     *
     * @param  list<array{id: int, priority: int, total: int}>  $candidates
     * @return array{id: int, priority: int, total: int}|null
     */
    public static function bestOffer(array $candidates): ?array
    {
        if ($candidates === []) {
            return null;
        }

        usort($candidates, fn (array $a, array $b) => [$a['total'], -$a['priority'], $a['id']] <=> [$b['total'], -$b['priority'], $b['id']]);

        return $candidates[0];
    }

    /** Discount of a code on the amount after the offer. */
    public static function codeDiscount(DiscountType $type, int $value, ?int $maxDiscount, int $afterOffer): int
    {
        $discount = match ($type) {
            DiscountType::Percentage => Money::mulDivRound($afterOffer, $value, 10000),
            DiscountType::Fixed => min($value, $afterOffer),
        };

        if ($type === DiscountType::Percentage && $maxDiscount !== null) {
            $discount = min($discount, $maxDiscount);
        }

        return max(0, min($discount, $afterOffer));
    }
}
