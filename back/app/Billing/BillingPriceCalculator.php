<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\BillingPeriod;
use App\Enums\SubscriptionSource;
use App\Models\Subscription;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * The only price authority for what merchants pay the platform (plans now, themes later).
 * Integer cents only. Discounted prices are rounded to the nearest pound.
 */
final class BillingPriceCalculator
{
    public function __construct(private readonly PlanCatalog $catalog) {}

    /** Null when the plan has no active price for that period. */
    public function planPrice(string $planKey, BillingPeriod $period, ?CarbonInterface $at = null): ?PlanPriceQuote
    {
        $row = $this->catalog->plan($planKey)['prices'][$period->value] ?? null;

        if ($row === null || ! $row['is_active']) {
            return null;
        }

        $at = CarbonImmutable::instance($at ?? now());
        $starts = $row['discount_starts_at'] === null ? null : CarbonImmutable::parse($row['discount_starts_at']);
        $ends = $row['discount_ends_at'] === null ? null : CarbonImmutable::parse($row['discount_ends_at']);
        // Both ends inclusive.
        $running = $row['discount_percent'] > 0
            && ($starts === null || $at->gte($starts))
            && ($ends === null || $at->lte($ends));
        $percent = $running ? $row['discount_percent'] : 0;

        return new PlanPriceQuote(
            planKey: $planKey,
            period: $period,
            originalCents: $row['price_cents'],
            discountPercent: $percent,
            finalCents: self::discounted($row['price_cents'], $percent),
            discountEndsAt: $running ? $ends : null,
        );
    }

    /** Percentage off, rounded to the nearest pound; 0% leaves the price untouched. */
    public static function discounted(int $cents, int $percent): int
    {
        $percent = max(0, min((int) config('landing.billing.max_discount_percent', 90), $percent));

        if ($percent === 0) {
            return $cents;
        }

        $raw = Money::mulDivRound($cents, 100 - $percent, 100);

        return max(0, Money::mulDivRound($raw, 1, 100) * 100);
    }

    /**
     * Price of moving to $target while $current runs. A higher plan (or monthly → yearly on the
     * same plan) starts now; within the first days of a paid period only the difference to what
     * was paid is due. Anything else (renewal, downgrade) starts when the current period ends.
     */
    public function change(?Subscription $current, PlanPriceQuote $target, ?CarbonInterface $at = null): UpgradeQuote
    {
        $at = CarbonImmutable::instance($at ?? now());

        if ($current === null || ! $this->isUpgrade($current, $target)) {
            return new UpgradeQuote($target, 0, $target->finalCents, $current === null);
        }

        $credit = 0;
        $windowEnds = CarbonImmutable::instance($current->starts_at)->addDays((int) config('landing.billing.upgrade_difference_days'));
        if ($current->source === SubscriptionSource::Payment && $at->lt($windowEnds)) {
            $credit = min($current->amountPaidCents(), $target->finalCents);
        }

        return new UpgradeQuote($target, $credit, $target->finalCents - $credit, true);
    }

    public function isUpgrade(Subscription $current, PlanPriceQuote $target): bool
    {
        $from = $this->catalog->rank($current->plan_key);
        $to = $this->catalog->rank($target->planKey);

        if ($to !== $from) {
            return $to > $from;
        }

        // Same plan: only monthly → yearly moves up. A trial / grant of the same plan is
        // replaced right away by the first payment.
        return $current->period === null
            || ($current->period === BillingPeriod::Monthly && $target->period === BillingPeriod::Yearly);
    }
}
