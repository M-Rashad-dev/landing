<?php

declare(strict_types=1);

namespace App\Billing;

use App\Enums\BillingPeriod;
use App\Enums\SubscriptionSource;
use App\Enums\SubscriptionStatus;
use App\Exceptions\ApiException;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Subscription;
use App\Models\Tenant;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Writes subscriptions and keeps the tenant's copy of its running plan in sync.
 * Every write ends with sync(), which also re-applies plan locks when the plan changed.
 */
final class SubscriptionManager
{
    public function __construct(
        private readonly PlanCatalog $catalog,
        private readonly PlatformSettings $settings,
        private readonly PlanLocks $locks,
    ) {}

    /** Free trial for a new tenant (once per tenant), when the admin has it on. */
    public function startTrial(Tenant $tenant): ?Subscription
    {
        $planKey = $this->settings->trialPlanKey();

        if (! $this->settings->trialEnabled() || $tenant->trial_used || ! $this->catalog->exists($planKey)) {
            return null;
        }

        $now = CarbonImmutable::now();
        $subscription = $this->write($tenant, function () use ($tenant, $planKey, $now): Subscription {
            $tenant->forceFill(['trial_used' => true])->save();

            return Subscription::query()->create([
                'plan_key' => $planKey,
                'period' => null,
                'source' => SubscriptionSource::Trial,
                'starts_at' => $now,
                'ends_at' => $now->addDays($this->settings->trialDays()),
                'snapshot' => $this->snapshot($planKey),
            ]);
        });

        return $subscription;
    }

    /**
     * Admin grant: the plan runs from now for $days, replacing what runs now.
     */
    public function grant(Tenant $tenant, string $planKey, int $days, ?string $note, ?int $adminId): Subscription
    {
        if (! $this->catalog->exists($planKey)) {
            throw new ApiException(422, 'plan_not_found', __('billing.plan_not_found'));
        }

        $now = CarbonImmutable::now();

        return $this->write($tenant, function () use ($planKey, $days, $note, $adminId, $now): Subscription {
            $this->endRunning($now);

            return Subscription::query()->create([
                'plan_key' => $planKey,
                'period' => null,
                'source' => SubscriptionSource::AdminGrant,
                'starts_at' => $now,
                'ends_at' => $now->addDays($days),
                'note' => $note,
                'created_by' => $adminId,
                'snapshot' => $this->snapshot($planKey),
            ]);
        });
    }

    /** Admin: add days to the running period (and push queued periods by the same days). */
    public function extend(Tenant $tenant, int $days): Subscription
    {
        $now = CarbonImmutable::now();

        return $this->write($tenant, function () use ($days, $now): Subscription {
            $running = $this->running($now)
                ?? $this->lastEnded($now, withinGrace: true)
                ?? throw new ApiException(422, 'no_running_subscription', __('billing.no_running_subscription'));

            $oldEnd = CarbonImmutable::instance($running->ends_at);
            // An expired-but-in-grace period continues from now, not from its old end.
            $base = $oldEnd->lt($now) ? $now : $oldEnd;
            $running->forceFill(['ends_at' => $base->addDays($days)])->save();

            Subscription::query()->live()->where('starts_at', '>=', $oldEnd)->whereKeyNot($running->id)->get()
                ->each(fn (Subscription $s) => $s->forceFill([
                    'starts_at' => CarbonImmutable::instance($s->starts_at)->addDays($days),
                    'ends_at' => CarbonImmutable::instance($s->ends_at)->addDays($days),
                ])->save());

            return $running;
        });
    }

    /**
     * A paid period (used by the payments feature). Upgrades start now and replace the running
     * period; renewals and downgrades are queued after the last live period.
     *
     * @param  array<string, mixed>  $snapshot
     */
    public function subscribe(Tenant $tenant, PlanPriceQuote $price, int $amountPaidCents, bool $startsNow, array $snapshot = []): Subscription
    {
        $now = CarbonImmutable::now();

        return $this->write($tenant, function () use ($price, $amountPaidCents, $startsNow, $snapshot, $now): Subscription {
            if ($startsNow) {
                $this->endRunning($now);
                $starts = $now;
            } else {
                $lastEnd = Subscription::query()->live()->max('ends_at');
                $starts = $lastEnd === null ? $now : CarbonImmutable::parse($lastEnd)->max($now);
            }

            return Subscription::query()->create([
                'plan_key' => $price->planKey,
                'period' => $price->period,
                'source' => SubscriptionSource::Payment,
                'starts_at' => $starts,
                'ends_at' => $starts->addDays($price->period->days()),
                'amount_paid' => Money::toDecimal($amountPaidCents),
                'currency' => (string) config('landing.billing.currency'),
                'snapshot' => $snapshot + $this->snapshot($price->planKey) + ['price' => $price->toArray()],
            ]);
        });
    }

    /** The period running now for the tenant, if any. */
    public function current(Tenant $tenant): ?Subscription
    {
        return Tenancy::runAs($tenant->id, fn (): ?Subscription => $this->running(CarbonImmutable::now()));
    }

    /** The paid period that can still be refunded now (3 days, once per 180 days), or null. */
    public function refundable(Tenant $tenant, ?CarbonInterface $at = null): ?Subscription
    {
        $at = CarbonImmutable::instance($at ?? now());

        return Tenancy::runAs($tenant->id, function () use ($at): ?Subscription {
            $running = $this->running($at);
            if ($running === null || $running->source !== SubscriptionSource::Payment) {
                return null;
            }
            if ($at->gte(CarbonImmutable::instance($running->starts_at)->addDays((int) config('landing.billing.refund_days')))) {
                return null;
            }
            $recent = Subscription::query()
                ->where('refunded_at', '>', $at->subDays((int) config('landing.billing.refund_cooldown_days')))
                ->exists();

            return $recent ? null : $running;
        });
    }

    /** Ends a refunded period at once (no grace). The payment side records the money. */
    public function markRefunded(Tenant $tenant, Subscription $subscription): void
    {
        $now = CarbonImmutable::now();

        $this->write($tenant, function () use ($subscription, $now): Subscription {
            $subscription->forceFill([
                'status' => SubscriptionStatus::Refunded,
                'refunded_at' => $now,
                'ends_at' => CarbonImmutable::instance($subscription->ends_at)->min($now),
            ])->save();

            return $subscription;
        });
    }

    /**
     * Copies the running period onto the tenant row (plan, dates, next check). When the plan
     * or the open / closed state changed, plan locks are re-applied and public pages purged.
     *
     * @return bool whether access changed
     */
    public function sync(Tenant $tenant): bool
    {
        $now = CarbonImmutable::now();
        $before = [$tenant->plan_key, $tenant->plan_state];

        Tenancy::runAs($tenant->id, fn () => DB::transaction(function () use ($tenant, $now): void {
            $row = Tenant::query()->whereKey($tenant->id)->lockForUpdate()->firstOrFail();
            $graceHours = $this->settings->graceHours();

            $running = $this->running($now);
            $queued = Subscription::query()->live()->where('starts_at', '>', $now)->orderBy('starts_at')->first();
            $queuedStart = $queued === null ? null : CarbonImmutable::instance($queued->starts_at);

            $current = $running ?? $this->lastEnded($now, withinGrace: false);
            $ends = $current === null ? null : CarbonImmutable::instance($current->ends_at);
            $graceEnds = $ends?->addHours($graceHours);

            $next = match (true) {
                $running !== null => $ends,
                $graceEnds !== null && $graceEnds->gt($now) => $graceEnds,
                default => null,
            };
            if ($queuedStart !== null && ($next === null || $queuedStart->lt($next))) {
                $next = $queuedStart;
            }

            $row->forceFill([
                'plan_key' => $current?->plan_key,
                'plan_period' => $current?->period,
                'plan_source' => $current?->source,
                'plan_ends_at' => $ends,
                'plan_grace_ends_at' => $graceEnds,
                'plan_next_check_at' => $next,
            ]);
            // Stored only to notice open ↔ closed flips; access itself is always read from the dates.
            $row->forceFill(['plan_state' => $row->accessState($now)->isOpen() ? 'open' : 'closed'])->save();

            $tenant->setRawAttributes($row->getAttributes(), true);
        }));

        $changed = $before !== [$tenant->plan_key, $tenant->plan_state];

        if ($changed) {
            $this->locks->sync($tenant);
            RevalidateTenantHosts::dispatch($tenant->id);
        }

        return $changed;
    }

    /**
     * @template T of Subscription
     *
     * @param  \Closure(): T  $callback
     * @return T
     */
    private function write(Tenant $tenant, \Closure $callback): Subscription
    {
        $subscription = Tenancy::runAs($tenant->id, fn () => DB::transaction(function () use ($tenant, $callback): Subscription {
            // One writer per tenant at a time.
            Tenant::query()->whereKey($tenant->id)->lockForUpdate()->first();

            return $callback();
        }));

        $this->sync($tenant);

        return $subscription;
    }

    private function running(CarbonInterface $at): ?Subscription
    {
        return Subscription::query()->runningAt($at)->orderByDesc('starts_at')->orderByDesc('id')->first();
    }

    /** The last live period that already ended (optionally only while still inside its grace hours). */
    private function lastEnded(CarbonInterface $at, bool $withinGrace): ?Subscription
    {
        $row = Subscription::query()->live()->where('ends_at', '<=', $at)->orderByDesc('ends_at')->orderByDesc('id')->first();

        if ($row !== null && $withinGrace && CarbonImmutable::instance($row->ends_at)->addHours($this->settings->graceHours())->lte($at)) {
            return null;
        }

        return $row;
    }

    /** Ends every period running at $at (an upgrade or grant takes over). */
    private function endRunning(CarbonImmutable $at): void
    {
        Subscription::query()->runningAt($at)->get()
            ->each(fn (Subscription $s) => $s->forceFill(['status' => SubscriptionStatus::Replaced, 'ends_at' => $at])->save());
    }

    /** @return array<string, mixed> */
    private function snapshot(string $planKey): array
    {
        $plan = $this->catalog->plan($planKey);

        return ['plan_name' => $plan['name'] ?? $planKey, 'values' => $plan['values'] ?? []];
    }

    /** Periods a plan is sold in (for validation). @return list<BillingPeriod> */
    public function periodsOf(string $planKey): array
    {
        $prices = $this->catalog->plan($planKey)['prices'] ?? [];

        return array_values(array_filter(BillingPeriod::cases(), fn (BillingPeriod $p) => ($prices[$p->value]['is_active'] ?? false)));
    }
}
