<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\OrderStatus;
use App\Models\AbTest;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\PageStat;
use App\Support\Money;
use App\Support\TrafficSource;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Store analytics from the daily page counters and the orders table (current tenant).
 * Orders count unless fake or cancelled; days are Cairo days.
 */
final class PageAnalytics
{
    public const TZ = 'Africa/Cairo';

    /** Views each variant needs before a verdict. */
    public const MIN_VIEWS = 100;

    /** @return array<string, mixed> */
    public function report(CarbonImmutable $from, CarbonImmutable $to, ?int $pageId = null): array
    {
        $stats = PageStat::query()
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->when($pageId, fn ($q) => $q->where('landing_page_id', $pageId))
            ->get(['landing_page_id', 'date', 'source', 'device', 'views', 'form_starts']);

        $orders = $this->orders($from, $to)->when($pageId, fn ($q) => $q->where('landing_page_id', $pageId))
            ->get(['id', 'landing_page_id', 'total', 'utm', 'created_at']);

        $views = (int) $stats->sum('views');
        $orderCount = $orders->count();
        // Conversion only counts orders of pages that have tracked visits (older orders came before tracking).
        $tracked = $stats->where('views', '>', 0)->pluck('landing_page_id')->unique();
        $convertedOrders = $orders->whereIn('landing_page_id', $tracked)->count();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'totals' => $this->totals($views, (int) $stats->sum('form_starts'), $orderCount, $this->revenue($orders), $convertedOrders),
            'daily' => $this->daily($from, $to, $stats, $orders),
            'pages' => $pageId ? [] : $this->pages($stats, $orders),
            'sources' => $this->sources($stats, $orders),
            'devices' => ['mobile' => (int) $stats->where('device', 'mobile')->sum('views'), 'desktop' => (int) $stats->where('device', 'desktop')->sum('views')],
        ];
    }

    /** @return array<string, mixed> */
    public function abTest(AbTest $test): array
    {
        $stats = PageStat::query()->where('ab_test_id', $test->id)->get(['landing_page_id', 'views', 'form_starts']);
        $orders = Order::query()->where('ab_test_id', $test->id)->whereNotIn('status', [OrderStatus::Fake, OrderStatus::Cancelled])->get(['landing_page_id', 'total']);

        $variant = function (int $pageId) use ($stats, $orders): array {
            $views = (int) $stats->where('landing_page_id', $pageId)->sum('views');
            $pageOrders = $orders->where('landing_page_id', $pageId);

            return $this->totals($views, (int) $stats->where('landing_page_id', $pageId)->sum('form_starts'), $pageOrders->count(), $this->revenue($pageOrders));
        };
        $a = $variant($test->page_a_id);
        $b = $variant($test->page_b_id);

        return ['a' => $a, 'b' => $b, 'verdict' => $this->verdict($a, $b)];
    }

    /**
     * Two-proportion z-test on conversion (orders / views).
     *
     * @param  array{views: int, orders: int}  $a
     * @param  array{views: int, orders: int}  $b
     * @return array{state: string, leader: string|null, confidence: int, lift: float|null}
     */
    public function verdict(array $a, array $b): array
    {
        if ($a['views'] < self::MIN_VIEWS || $b['views'] < self::MIN_VIEWS) {
            return ['state' => 'collecting', 'leader' => null, 'confidence' => 0, 'lift' => null];
        }

        $pa = $a['orders'] / $a['views'];
        $pb = $b['orders'] / $b['views'];
        $pooled = ($a['orders'] + $b['orders']) / ($a['views'] + $b['views']);
        $se = sqrt($pooled * (1 - $pooled) * (1 / $a['views'] + 1 / $b['views']));
        $z = $se > 0 ? abs($pa - $pb) / $se : 0.0;
        $confidence = (int) floor((2 * $this->normalCdf($z) - 1) * 100);
        $leader = $pa === $pb ? null : ($pb > $pa ? 'b' : 'a');
        $base = $leader === 'b' ? $pa : $pb;
        $lift = $leader === null || $base == 0 ? null : round((max($pa, $pb) - $base) / $base * 100, 1);

        return ['state' => $confidence >= 95 && $leader !== null ? 'winner' : 'too_close', 'leader' => $leader, 'confidence' => $confidence, 'lift' => $lift];
    }

    /** @return Builder<Order> */
    private function orders(CarbonImmutable $from, CarbonImmutable $to)
    {
        return Order::query()
            ->whereBetween('created_at', [$from->startOfDay()->utc(), $to->endOfDay()->utc()])
            ->whereNotIn('status', [OrderStatus::Fake, OrderStatus::Cancelled]);
    }

    /**
     * Conversion is null without visits (nothing to divide by).
     *
     * @return array{views: int, form_starts: int, orders: int, revenue: float, conversion: float|null}
     */
    private function totals(int $views, int $formStarts, int $orders, int $revenueCents, ?int $convertedOrders = null): array
    {
        return [
            'views' => $views,
            'form_starts' => $formStarts,
            'orders' => $orders,
            'revenue' => Money::toFloat($revenueCents),
            'conversion' => $views > 0 ? round(($convertedOrders ?? $orders) / $views * 100, 2) : null,
        ];
    }

    /** @param Collection<int, Order> $orders */
    private function revenue(Collection $orders): int
    {
        return (int) $orders->sum(fn (Order $order) => Money::toCents((string) $order->total));
    }

    /**
     * @param  Collection<int, PageStat>  $stats
     * @param  Collection<int, Order>  $orders
     * @return list<array{date: string, views: int, orders: int}>
     */
    private function daily(CarbonImmutable $from, CarbonImmutable $to, Collection $stats, Collection $orders): array
    {
        $views = $stats->groupBy(fn (PageStat $s) => substr((string) $s->date, 0, 10))->map(fn ($rows) => (int) $rows->sum('views'));
        $perDay = $orders->groupBy(fn (Order $o) => $o->created_at->setTimezone(self::TZ)->toDateString())->map->count();

        $days = [];
        for ($day = $from; $day->lte($to); $day = $day->addDay()) {
            $key = $day->toDateString();
            $days[] = ['date' => $key, 'views' => (int) ($views[$key] ?? 0), 'orders' => (int) ($perDay[$key] ?? 0)];
        }

        return $days;
    }

    /**
     * @param  Collection<int, PageStat>  $stats
     * @param  Collection<int, Order>  $orders
     * @return list<array<string, mixed>>
     */
    private function pages(Collection $stats, Collection $orders): array
    {
        $ids = $stats->pluck('landing_page_id')->merge($orders->pluck('landing_page_id'))->filter()->unique()->values();
        $titles = LandingPage::query()->withTrashed()->whereIn('id', $ids)->get(['id', 'title', 'slug', 'status'])->keyBy('id');

        return $ids->map(function (int $id) use ($stats, $orders, $titles): array {
            $pageOrders = $orders->where('landing_page_id', $id);
            $page = $titles[$id] ?? null;

            return ['id' => $id, 'title' => $page?->title ?? '—', 'slug' => $page?->slug, 'deleted' => $page?->trashed() ?? true]
                + $this->totals((int) $stats->where('landing_page_id', $id)->sum('views'), (int) $stats->where('landing_page_id', $id)->sum('form_starts'), $pageOrders->count(), $this->revenue($pageOrders));
        })->sortByDesc('orders')->values()->all();
    }

    /**
     * @param  Collection<int, PageStat>  $stats
     * @param  Collection<int, Order>  $orders
     * @return list<array{source: string, views: int, orders: int}>
     */
    private function sources(Collection $stats, Collection $orders): array
    {
        $orderSources = $orders->countBy(fn (Order $o) => TrafficSource::classify($o->utm['source'] ?? null, $o->utm['referrer'] ?? null));

        return collect(TrafficSource::SOURCES)
            ->map(fn (string $source) => ['source' => $source, 'views' => (int) $stats->where('source', $source)->sum('views'), 'orders' => (int) ($orderSources[$source] ?? 0)])
            ->filter(fn (array $row) => $row['views'] > 0 || $row['orders'] > 0)
            ->sortByDesc('views')
            ->values()
            ->all();
    }

    /** Standard normal CDF (Abramowitz–Stegun 7.1.26 approximation of erf). */
    private function normalCdf(float $z): float
    {
        $x = $z / M_SQRT2;
        $t = 1 / (1 + 0.3275911 * abs($x));
        $erf = 1 - ((((1.061405429 * $t - 1.453152027) * $t + 1.421413741) * $t - 0.284496736) * $t + 0.254829592) * $t * exp(-$x * $x);

        return 0.5 * (1 + ($x >= 0 ? $erf : -$erf));
    }
}
