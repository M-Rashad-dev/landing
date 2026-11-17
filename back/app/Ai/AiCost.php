<?php

declare(strict_types=1);

namespace App\Ai;

/** What a call cost in USD, from the per-1M-token prices of config/ai.php. */
final class AiCost
{
    public static function priced(string $model): bool
    {
        return is_array(config("ai.prices.{$model}"));
    }

    public static function usd(string $model, int $input, int $output, int $cached = 0): float
    {
        $price = config("ai.prices.{$model}");
        if (! is_array($price)) {
            return 0.0;
        }
        $cached = min($cached, $input);
        $usd = (($input - $cached) * (float) ($price['input'] ?? 0)
            + $cached * (float) ($price['cached'] ?? $price['input'] ?? 0)
            + $output * (float) ($price['output'] ?? 0)) / 1_000_000;

        return round($usd, 6);
    }
}
