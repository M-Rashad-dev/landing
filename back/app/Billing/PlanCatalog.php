<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\BillingPeriod;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Models\Plan;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;

/**
 * Every plan with its prices and entitlement values, read once and cached as plain arrays
 * (object unserialization is off). Any plan / price / value save flushes it.
 *
 * @phpstan-type PriceRow array{price_cents: int, discount_percent: int, discount_starts_at: string|null, discount_ends_at: string|null, is_active: bool}
 * @phpstan-type PlanRow array{key: string, name: string, tagline: string|null, description: string|null, marketing_points: list<string>, is_public: bool, is_highlighted: bool, is_archived: bool, sort_order: int, values: array<string, int|null>, prices: array<string, PriceRow>}
 */
final class PlanCatalog
{
    private const CACHE_KEY = 'billing:catalog:v1';

    /** @var array<string, PlanRow>|null */
    private ?array $memo = null;

    /** @return array<string, PlanRow> plans by key, in display order */
    public function all(): array
    {
        return $this->memo ??= Cache::rememberForever(self::CACHE_KEY, fn (): array => $this->load());
    }

    /** @return PlanRow|null */
    public function plan(?string $key): ?array
    {
        return $key === null ? null : ($this->all()[$key] ?? null);
    }

    public function exists(string $key): bool
    {
        return $this->plan($key) !== null;
    }

    /** Plans a merchant can choose (public, not archived), cheapest rank first. @return array<string, PlanRow> */
    public function sellable(): array
    {
        return array_filter($this->all(), fn (array $plan): bool => $plan['is_public'] && ! $plan['is_archived']);
    }

    /** Rank for upgrade / downgrade decisions: the admin's display order. */
    public function rank(string $key): int
    {
        return $this->plan($key)['sort_order'] ?? 0;
    }

    /**
     * The first sellable plan that has the feature on (for "upgrade to …" messages).
     *
     * @return array{key: string, name: string}|null
     */
    public function cheapestWithFeature(PlanFeature $feature): ?array
    {
        foreach ($this->sellable() as $plan) {
            if (($plan['values'][$feature->value] ?? 0) > 0) {
                return ['key' => $plan['key'], 'name' => $plan['name']];
            }
        }

        return null;
    }

    /**
     * The first sellable plan whose limit is above $current (null = unlimited counts as above).
     *
     * @return array{key: string, name: string}|null
     */
    public function cheapestAbove(PlanLimit $limit, int $current): ?array
    {
        foreach ($this->sellable() as $plan) {
            if (! array_key_exists($limit->value, $plan['values'])) {
                continue;
            }
            $value = $plan['values'][$limit->value];
            if ($value === null || $value > $current) {
                return ['key' => $plan['key'], 'name' => $plan['name']];
            }
        }

        return null;
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);

        if (app()->resolved(self::class)) {
            app(self::class)->memo = null;
        }
    }

    /** @return array<string, PlanRow> */
    private function load(): array
    {
        $plans = Plan::query()
            ->with(['prices', 'values'])
            ->orderBy('sort_order')
            ->orderBy('key')
            ->get();

        $rows = [];
        foreach ($plans as $plan) {
            $values = [];
            foreach ($plan->values as $value) {
                $values[$value->entitlement] = $value->value;
            }

            // Stable order: monthly before yearly.
            $prices = [];
            foreach (BillingPeriod::cases() as $period) {
                $price = $plan->prices->first(fn ($row) => $row->period === $period);
                if ($price === null) {
                    continue;
                }
                $prices[$period->value] = [
                    'price_cents' => Money::toCents((string) $price->price),
                    'discount_percent' => $price->discount_percent,
                    'discount_starts_at' => $price->discount_starts_at?->toIso8601ZuluString(),
                    'discount_ends_at' => $price->discount_ends_at?->toIso8601ZuluString(),
                    'is_active' => $price->is_active,
                ];
            }

            $rows[$plan->key] = [
                'key' => $plan->key,
                'name' => $plan->name,
                'tagline' => $plan->tagline,
                'description' => $plan->description,
                'marketing_points' => array_values($plan->marketing_points ?? []),
                'is_public' => $plan->is_public,
                'is_highlighted' => $plan->is_highlighted,
                'is_archived' => $plan->is_archived,
                'sort_order' => $plan->sort_order,
                'values' => $values,
                'prices' => $prices,
            ];
        }

        return $rows;
    }
}
