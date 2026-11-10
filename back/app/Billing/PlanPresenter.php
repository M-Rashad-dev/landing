<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\BillingPeriod;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Models\Subscription;

/**
 * JSON shapes of plans for the pricing pages (dashboard + marketing) and the admin editor.
 * Catalog rows are plain arrays (see PlanCatalog).
 */
final class PlanPresenter
{
    public function __construct(
        private readonly PlanCatalog $catalog,
        private readonly BillingPriceCalculator $prices,
    ) {}

    /**
     * What the dashboard needs on every screen (no counting): state, plan, dates, every
     * feature and limit. Shared by /auth/me and billing/entitlements.
     *
     * @return array<string, mixed>
     */
    public static function entitlements(TenantEntitlements $e): array
    {
        $limits = [];
        foreach (PlanLimit::cases() as $limit) {
            $limits[$limit->value] = ['limit' => $e->limit($limit), 'unlimited' => $e->isUnlimited($limit)];
        }
        $features = [];
        foreach (PlanFeature::cases() as $feature) {
            $features[$feature->value] = $e->allows($feature);
        }

        $reminders = (array) config('landing.billing.renewal_reminder_days');
        $daysLeft = $e->endsAt === null ? null : max(0, (int) ceil(now()->diffInHours($e->endsAt, false) / 24));

        return [
            'state' => $e->state->value,
            'plan' => $e->planKey === null ? null : ['key' => $e->planKey, 'name' => $e->planName],
            'period' => $e->period?->value,
            'is_trial' => $e->isTrial,
            'ends_at' => $e->endsAt?->toIso8601ZuluString(),
            'grace_ends_at' => $e->graceEndsAt?->toIso8601ZuluString(),
            'days_left' => $daysLeft,
            // Banner from the first reminder day (7) until the end.
            'renewal_due' => $daysLeft !== null && $reminders !== [] && $daysLeft <= max($reminders),
            'features' => $features,
            'limits' => $limits,
        ];
    }

    /**
     * Every entitlement the code enforces, in display order (limits first).
     *
     * @return list<array{key: string, kind: string, label: string}>
     */
    public static function entitlementCatalog(): array
    {
        return [
            ...array_map(fn (PlanLimit $l) => ['key' => $l->value, 'kind' => 'limit', 'label' => $l->label()], PlanLimit::cases()),
            ...array_map(fn (PlanFeature $f) => ['key' => $f->value, 'kind' => 'feature', 'label' => $f->label()], PlanFeature::cases()),
        ];
    }

    /**
     * Sellable plans with today's prices. With $current, each price also says what moving
     * there costs now (difference inside the first days, queued or immediate).
     *
     * @return list<array<string, mixed>>
     */
    public function pricing(?Subscription $current = null, ?string $currentPlanKey = null, ?BillingPeriod $currentPeriod = null): array
    {
        $plans = [];
        foreach ($this->catalog->sellable() as $plan) {
            $prices = [];
            foreach (BillingPeriod::cases() as $period) {
                $quote = $this->prices->planPrice($plan['key'], $period);
                if ($quote === null) {
                    continue;
                }
                $row = $quote->toArray();
                if ($current !== null || $currentPlanKey !== null) {
                    $row['is_current'] = $plan['key'] === $currentPlanKey && $period === $currentPeriod;
                    $row['change'] = $this->prices->change($current, $quote)->toArray();
                }
                $prices[$period->value] = $row;
            }

            if ($prices === []) {
                continue;
            }

            $plans[] = [
                'key' => $plan['key'],
                'name' => $plan['name'],
                'tagline' => $plan['tagline'],
                'description' => $plan['description'],
                'marketing_points' => $plan['marketing_points'],
                'is_highlighted' => $plan['is_highlighted'],
                'prices' => $prices,
                'values' => $this->values($plan),
            ];
        }

        return $plans;
    }

    /**
     * Admin editor shape: everything, archived plans included, raw prices.
     *
     * @param  array<string, int>  $subscribers  running tenants per plan key
     * @return list<array<string, mixed>>
     */
    public function admin(array $subscribers): array
    {
        $rows = [];
        foreach ($this->catalog->all() as $plan) {
            $prices = [];
            foreach (BillingPeriod::cases() as $period) {
                $price = $plan['prices'][$period->value] ?? null;
                $prices[$period->value] = $price === null ? null : [
                    'price' => $price['price_cents'] / 100,
                    'discount_percent' => $price['discount_percent'],
                    'discount_starts_at' => $price['discount_starts_at'],
                    'discount_ends_at' => $price['discount_ends_at'],
                    'is_active' => $price['is_active'],
                    'now' => $this->prices->planPrice($plan['key'], $period)?->toArray(),
                ];
            }

            $rows[] = [
                'key' => $plan['key'],
                'name' => $plan['name'],
                'tagline' => $plan['tagline'],
                'description' => $plan['description'],
                'marketing_points' => $plan['marketing_points'],
                'is_public' => $plan['is_public'],
                'is_highlighted' => $plan['is_highlighted'],
                'is_archived' => $plan['is_archived'],
                'sort_order' => $plan['sort_order'],
                'prices' => $prices,
                'values' => $this->values($plan),
                'subscribers' => $subscribers[$plan['key']] ?? 0,
            ];
        }

        return $rows;
    }

    /**
     * Features as booleans, limits as numbers (null = unlimited). Missing = closed.
     *
     * @param  array{values: array<string, int|null>}  $plan
     * @return array<string, bool|int|null>
     */
    private function values(array $plan): array
    {
        $values = [];
        foreach (PlanLimit::cases() as $limit) {
            $values[$limit->value] = array_key_exists($limit->value, $plan['values']) ? $plan['values'][$limit->value] : 0;
        }
        foreach (PlanFeature::cases() as $feature) {
            $values[$feature->value] = ($plan['values'][$feature->value] ?? 0) > 0;
        }

        return $values;
    }
}
