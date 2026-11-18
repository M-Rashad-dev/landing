<?php

declare(strict_types=1);

namespace App\Ai;

/** What a call cost in USD, from the per-1M-token prices of config/ai.php. */
final class AiCost
{
    public static function priced(string $model): bool
    {
        return self::free($model) || self::price($model) !== null || self::imagePrice($model) !== null;
    }

    /** USD per image of an image model (null = not listed); «:free» models cost nothing. */
    public static function imagePrice(string $model): ?float
    {
        if (self::free($model)) {
            return 0.0;
        }
        $price = ((array) config('ai.image_prices'))[$model] ?? null;

        return is_numeric($price) ? (float) $price : null;
    }

    /** OpenRouter's «:free» models (local trials) cost nothing. */
    public static function free(string $model): bool
    {
        return str_ends_with($model, ':free');
    }

    /**
     * The model's prices (read from the whole list: model names have dots, like qwen3.7-…).
     *
     * @return array<string, float|int>|null
     */
    private static function price(string $model): ?array
    {
        $price = ((array) config('ai.prices'))[$model] ?? null;

        return is_array($price) ? $price : null;
    }

    public static function usd(string $model, int $input, int $output, int $cached = 0): float
    {
        $price = self::price($model);
        if ($price === null) {
            return 0.0;
        }
        $cached = min($cached, $input);
        $usd = (($input - $cached) * (float) ($price['input'] ?? 0)
            + $cached * (float) ($price['cached'] ?? $price['input'] ?? 0)
            + $output * (float) ($price['output'] ?? 0)) / 1_000_000;

        return round($usd, 6);
    }
}
