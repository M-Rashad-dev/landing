<?php

declare(strict_types=1);

namespace App\Services;

use App\Billing\PlanCatalog;
use App\Enums\InvoiceStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\SubscriptionSource;
use App\Enums\TenantStatus;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Tenant;
use App\Support\CairoTime;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Platform-wide numbers for the super admin (home page, daily email). Audited bypass: these
 * read orders, invoices and payments of every store, so each query runs inside
 * Tenancy::withoutTenant() (allowed for the Admin group, PLAN 4).
 */
final class PlatformStats
{
    /** Orders that are not sales (the same rule as the store analytics). */
    public const NOT_SALES = [OrderStatus::Cancelled, OrderStatus::Fake];

    public function __construct(private readonly PlanCatalog $plans) {}

    /** @return array<string, mixed> */
    public function overview(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now(CairoTime::ZONE);
        $now = $now->setTimezone(CairoTime::ZONE);
        $today = $now->startOfDay();
        // Windows that run to now end at midnight (nothing is in the future; a row of this very second still counts).
        $tomorrow = $today->addDay();
        $month = $now->startOfMonth();
        $previous = $month->subMonthNoOverflow();
        // The same stretch of last month (1st → same day and hour), so a half month is never compared with a full one.
        $previousEnd = $previous->addSeconds((int) $month->diffInSeconds($now));
        $previousEnd = $previousEnd->greaterThan($month) ? $month : $previousEnd;

        $utc = CarbonImmutable::now('UTC');

        return [
            'stores' => [
                'total' => Tenant::query()->count(),
                'active' => Tenant::query()->where('status', TenantStatus::Active)->count(),
                'suspended' => Tenant::query()->where('status', TenantStatus::Suspended)->count(),
                'new_week' => Tenant::query()->where('created_at', '>=', $utc->subDays(7))->count(),
                'new_month' => Tenant::query()->where('created_at', '>=', $month->utc())->count(),
            ],
            'subscriptions' => [
                'trials' => $this->running(SubscriptionSource::Trial)->count(),
                'paying' => $this->running(SubscriptionSource::Payment)->count(),
                'gifted' => $this->running(SubscriptionSource::AdminGrant)->count(),
                'expiring_week' => $this->expiringWeek(),
                'expired' => $this->expired(),
                'plans' => $this->runningPlans(),
            ],
            'billing' => [
                'revenue_month' => Money::toFloat($this->revenue($month, $tomorrow)),
                'revenue_previous' => Money::toFloat($this->revenue($previous, $previousEnd)),
                'pending_payments' => $this->pendingPayments(),
                'refund_requests' => $this->refundRequests(),
            ],
            'activity' => [
                'orders_today' => $this->salesCount($today, $tomorrow),
                'orders_month' => $this->salesCount($month, $tomorrow),
                'orders_previous' => $this->salesCount($previous, $previousEnd),
                'sales_month' => Money::toFloat($this->salesTotal($month, $tomorrow)),
                'sales_previous' => Money::toFloat($this->salesTotal($previous, $previousEnd)),
            ],
            'days' => $this->days($today->subDays(29), $tomorrow),
            'top_stores' => $this->topStores($month, $tomorrow),
        ];
    }

    /**
     * One Cairo day (the daily email).
     *
     * @return array{new_stores: int, orders: int, sales: int, revenue: int, pending_payments: int, refund_requests: int, expiring_week: int}
     */
    public function day(CarbonImmutable $day): array
    {
        $from = $day->setTimezone(CairoTime::ZONE)->startOfDay();
        $to = $from->addDay();

        return [
            'new_stores' => Tenant::query()->where('created_at', '>=', $from->utc())->where('created_at', '<', $to->utc())->count(),
            'orders' => $this->salesCount($from, $to),
            'sales' => $this->salesTotal($from, $to),
            'revenue' => $this->revenue($from, $to),
            'pending_payments' => $this->pendingPayments(),
            'refund_requests' => $this->refundRequests(),
            'expiring_week' => $this->expiringWeek(),
        ];
    }

    public function pendingPayments(): int
    {
        return Tenancy::withoutTenant(fn (): int => Payment::query()->where('status', PaymentStatus::PendingReview)->count());
    }

    public function refundRequests(): int
    {
        return Tenancy::withoutTenant(fn (): int => Invoice::query()->where('status', InvoiceStatus::Paid)->whereNotNull('refund_requested_at')->count());
    }

    private function expiringWeek(): int
    {
        return Tenant::query()->whereBetween('plan_ends_at', [now(), now()->addDays(7)])->count();
    }

    private function expired(): int
    {
        return Tenant::query()->where(fn (Builder $q) => $q->whereNull('plan_grace_ends_at')->orWhere('plan_grace_ends_at', '<=', now()))->count();
    }

    /** @return Builder<Tenant> */
    private function running(SubscriptionSource $source): Builder
    {
        return Tenant::query()->where('plan_source', $source)->where('plan_ends_at', '>', now());
    }

    /** Paid plan and theme invoices (refunded ones no longer count), in cents. */
    private function revenue(CarbonImmutable $from, CarbonImmutable $to): int
    {
        return Money::toCents((string) Tenancy::withoutTenant(fn () => Invoice::query()
            ->where('status', InvoiceStatus::Paid)
            ->where('paid_at', '>=', $from->utc())->where('paid_at', '<', $to->utc())
            ->sum('total')));
    }

    /**
     * Runs $read on the orders that count as sales in a window (inside the audited bypass).
     *
     * @template T
     *
     * @param  callable(Builder<Order>): T  $read
     * @return T
     */
    private function sales(CarbonImmutable $from, CarbonImmutable $to, callable $read): mixed
    {
        return Tenancy::withoutTenant(fn () => $read(Order::query()
            ->whereNotIn('status', self::NOT_SALES)
            ->where('created_at', '>=', $from->utc())->where('created_at', '<', $to->utc())));
    }

    private function salesCount(CarbonImmutable $from, CarbonImmutable $to): int
    {
        return $this->sales($from, $to, fn (Builder $q): int => $q->count());
    }

    private function salesTotal(CarbonImmutable $from, CarbonImmutable $to): int
    {
        return Money::toCents((string) $this->sales($from, $to, fn (Builder $q) => $q->sum('total')));
    }

    /**
     * New stores, orders and sales per Cairo day. Orders are grouped by UTC hour in SQL, then
     * moved to their Cairo day here (no time zone tables needed in MySQL).
     *
     * @return list<array{date: string, stores: int, orders: int, sales: float}>
     */
    private function days(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $days = [];
        for ($d = $from; $d->lessThan($to); $d = $d->addDay()) {
            $days[$d->toDateString()] = ['date' => $d->toDateString(), 'stores' => 0, 'orders' => 0, 'sales' => 0];
        }

        $hours = $this->sales($from, $to, fn (Builder $q) => $q
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour, count(*) as orders, sum(total) as sales")
            ->groupBy('hour')
            ->toBase()
            ->get());
        foreach ($hours as $row) {
            $key = CarbonImmutable::parse((string) $row->hour, 'UTC')->setTimezone(CairoTime::ZONE)->toDateString();
            if (isset($days[$key])) {
                $days[$key]['orders'] += (int) $row->orders;
                $days[$key]['sales'] += Money::toCents((string) $row->sales);
            }
        }

        $created = Tenant::query()->where('created_at', '>=', $from->utc())->pluck('created_at');
        foreach ($created as $at) {
            $key = CarbonImmutable::parse($at)->setTimezone(CairoTime::ZONE)->toDateString();
            if (isset($days[$key])) {
                $days[$key]['stores']++;
            }
        }

        return array_values(array_map(fn (array $d) => ['sales' => Money::toFloat($d['sales'])] + $d, $days));
    }

    /** @return list<array{id: int, name: string, orders: int, sales: float}> */
    private function topStores(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = $this->sales($from, $to, fn (Builder $q) => $q
            ->selectRaw('tenant_id, count(*) as orders, sum(total) as sales')
            ->groupBy('tenant_id')
            ->orderByDesc('sales')
            ->limit(5)
            ->toBase()
            ->get());
        $names = Tenant::query()->whereIn('id', $rows->pluck('tenant_id'))->pluck('name', 'id');

        return $rows->map(fn ($r) => [
            'id' => (int) $r->tenant_id,
            'name' => (string) ($names[$r->tenant_id] ?? ''),
            'orders' => (int) $r->orders,
            'sales' => Money::toFloat(Money::toCents((string) $r->sales)),
        ])->values()->all();
    }

    /** @return list<array{key: string, name: string, total: int}> stores per running plan, in plan order */
    private function runningPlans(): array
    {
        $totals = Tenant::query()->whereNotNull('plan_key')->where('plan_ends_at', '>', now())
            ->selectRaw('plan_key, count(*) as total')->groupBy('plan_key')->pluck('total', 'plan_key');

        $rows = [];
        foreach ($this->plans->all() as $plan) {
            if (isset($totals[$plan['key']])) {
                $rows[] = ['key' => $plan['key'], 'name' => $plan['name'], 'total' => (int) $totals[$plan['key']]];
            }
        }

        return $rows;
    }
}
