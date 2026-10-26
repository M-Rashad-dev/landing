<?php

declare(strict_types=1);

namespace App\Support;

/**
 * Money helpers: the database stores decimal(12,2) strings, the code works in
 * integer cents (piasters). Never floats.
 */
final class Money
{
    /** "350.5" / "350.50" / 350 → 35050 */
    public static function toCents(string|int|null $amount): int
    {
        if ($amount === null || $amount === '') {
            return 0;
        }

        if (is_int($amount)) {
            return $amount * 100;
        }

        $amount = trim($amount);
        $negative = str_starts_with($amount, '-');
        $amount = ltrim($amount, '-+');

        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');
        $fraction = substr($fraction.'000', 0, 3);
        $cents = ((int) $whole) * 100 + (int) substr($fraction, 0, 2);

        // Round half up on the third decimal.
        if ((int) $fraction[2] >= 5) {
            $cents++;
        }

        return $negative ? -$cents : $cents;
    }

    /** 35050 → "350.50" (for the database). */
    public static function toDecimal(int $cents): string
    {
        $negative = $cents < 0;
        $cents = abs($cents);

        return ($negative ? '-' : '').intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }

    /** 35050 → 350.5 (JSON number with two decimals of precision). */
    public static function toFloat(int $cents): float
    {
        return round($cents / 100, 2);
    }

    /** round(a * b / c) with half-up rounding, in integers. */
    public static function mulDivRound(int $a, int $b, int $c): int
    {
        $product = $a * $b;
        $quotient = intdiv($product, $c);
        $remainder = $product % $c;

        return 2 * abs($remainder) >= abs($c) ? $quotient + ($product >= 0 ? 1 : -1) : $quotient;
    }
}
