<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\OrderStatus;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\AbandonedLead;
use App\Models\Customer;
use App\Models\Media;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\StoreStat;
use App\Support\Money;
use App\Support\TrafficSource;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * «التحليلات» of the store: visits and the purchase steps (first-party counters, no personal
 * data), orders and sales per Cairo day, compared with the same number of days just before;
 * where visitors and orders come from, devices, new and returning customers, abandoned carts,
 * best products, governorates and the hours customers order at. Store orders only; cancelled
 * and fake orders do not count.
 */
final class StoreAnalyticsController extends Controller
{
    use RespondsWithJson;

    private const TZ = 'Africa/Cairo';

    public function __invoke(Request $request, Entitlements $entitlements): JsonResponse
    {
        $entitlements->ensure(PlanFeature::Store);
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        $to = isset($data['to']) ? CarbonImmutable::parse($data['to'], self::TZ) : CarbonImmutable::now(self::TZ)->startOfDay();
        $from = isset($data['from']) ? CarbonImmutable::parse($data['from'], self::TZ) : $to->subDays(29);
        if ($from->diffInDays($to) > 366) {
            $from = $to->subDays(366);
        }
        $days = (int) $from->diffInDays($to) + 1;
        $previousTo = $from->subDay();
        $previousFrom = $previousTo->subDays($days - 1);

        $now = $this->period($from, $to);
        $before = $this->period($previousFrom, $previousTo);

        return $this->ok([
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'days' => $days, 'previous_from' => $previousFrom->toDateString(), 'previous_to' => $previousTo->toDateString()],
            'totals' => $now['totals'],
            'previous' => $before['totals'],
            'days' => $now['days'],
            'sources' => $now['sources'],
            'devices' => $now['devices'],
            'top_products' => $this->topProducts($now['orders']),
            'governorates' => $this->governorates($now['orders']),
            'hours' => $this->hours($now['orders']),
        ]);
    }

    /**
     * Everything that has a "previous period" twin, plus the rows the rest is built from.
     *
     * @return array{totals: array<string, int|float|null>, days: list<array<string, mixed>>, sources: list<array<string, mixed>>, devices: list<array<string, mixed>>, orders: Collection<int, Order>}
     */
    private function period(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $start = $from->startOfDay()->utc();
        $end = $to->endOfDay()->utc();

        $stats = StoreStat::query()->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get(['date', 'source', 'device', 'views', 'product_views', 'add_to_cart', 'checkouts']);
        $orders = Order::query()->where('source', 'store')
            ->whereNotIn('status', [OrderStatus::Cancelled, OrderStatus::Fake])
            ->whereBetween('created_at', [$start, $end])
            ->get(['id', 'total', 'created_at', 'customer_id', 'governorate', 'utm', 'status']);

        $byDay = [];
        for ($d = $from; $d->lte($to); $d = $d->addDay()) {
            $byDay[$d->toDateString()] = ['date' => $d->toDateString(), 'views' => 0, 'product_views' => 0, 'add_to_cart' => 0, 'checkouts' => 0, 'orders' => 0, 'revenue' => 0];
        }
        $sources = [];
        $devices = ['mobile' => 0, 'desktop' => 0];
        foreach ($stats as $row) {
            $day = $row->date->toDateString();
            foreach (['views', 'product_views', 'add_to_cart', 'checkouts'] as $k) {
                $byDay[$day][$k] += (int) $row->{$k};
            }
            $sources[$row->source] ??= ['views' => 0, 'orders' => 0, 'revenue' => 0];
            $sources[$row->source]['views'] += (int) $row->views;
            $devices[$row->device === 'desktop' ? 'desktop' : 'mobile'] += (int) $row->views;
        }
        foreach ($orders as $order) {
            $cents = Money::toCents((string) $order->total);
            $day = $order->created_at->setTimezone(self::TZ)->toDateString();
            if (isset($byDay[$day])) {
                $byDay[$day]['orders']++;
                $byDay[$day]['revenue'] += $cents;
            }
            // The order's own first touch (utm / referrer kept on the order).
            $utm = is_array($order->utm) ? $order->utm : [];
            $source = TrafficSource::classify($utm['source'] ?? null, $utm['referrer'] ?? null);
            $sources[$source] ??= ['views' => 0, 'orders' => 0, 'revenue' => 0];
            $sources[$source]['orders']++;
            $sources[$source]['revenue'] += $cents;
        }

        $sum = fn (string $k) => array_sum(array_column($byDay, $k));
        $views = $sum('views');
        $orderCount = $orders->count();
        $revenue = $sum('revenue');

        // New = their first order ever is in the period; returning = they ordered before it.
        $customerIds = $orders->pluck('customer_id')->filter()->unique()->values();
        $newCustomers = $customerIds->isEmpty() ? 0 : Customer::query()->whereIn('id', $customerIds)->where('first_order_at', '>=', $start)->count();

        $abandoned = AbandonedLead::query()->whereIn('source', ['store', 'cart'])->whereBetween('created_at', [$start, $end]);
        $abandonedCount = (clone $abandoned)->count();
        $recovered = (clone $abandoned)->whereNotNull('order_id')->count();

        $rate = fn (int $part, int $whole) => $whole > 0 ? round($part * 100 / $whole, 2) : null;

        return [
            'totals' => [
                'views' => $views,
                'product_views' => $sum('product_views'),
                'add_to_cart' => $sum('add_to_cart'),
                'checkouts' => $sum('checkouts'),
                'orders' => $orderCount,
                'revenue' => Money::toFloat($revenue),
                'average_order' => $orderCount > 0 ? Money::toFloat(intdiv($revenue, $orderCount)) : 0.0,
                'conversion' => $rate($orderCount, $views),
                'cart_rate' => $rate($sum('add_to_cart'), $views),
                'checkout_rate' => $rate($orderCount, $sum('checkouts')),
                'delivered' => $orders->where('status', OrderStatus::Delivered)->count(),
                'customers' => $customerIds->count(),
                'new_customers' => $newCustomers,
                'returning_customers' => $customerIds->count() - $newCustomers,
                'abandoned' => $abandonedCount,
                'recovered' => $recovered,
            ],
            'days' => array_values(array_map(fn (array $d) => ['revenue' => Money::toFloat($d['revenue'])] + $d, $byDay)),
            'sources' => collect($sources)
                ->map(fn (array $s, string $source) => ['source' => $source, 'views' => $s['views'], 'orders' => $s['orders'], 'revenue' => Money::toFloat($s['revenue']), 'conversion' => $rate($s['orders'], $s['views'])])
                ->sortByDesc(fn (array $s) => [$s['views'], $s['orders']])->values()->all(),
            'devices' => [['device' => 'mobile', 'views' => $devices['mobile']], ['device' => 'desktop', 'views' => $devices['desktop']]],
            'orders' => $orders,
        ];
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return list<array<string, mixed>>
     */
    private function topProducts(Collection $orders): array
    {
        $rows = OrderItem::query()->whereIn('order_id', $orders->pluck('id'))->where('is_gift', false)
            ->selectRaw('product_id, max(product_name) as name, sum(quantity) as units, sum(line_total) as revenue, count(distinct order_id) as orders')
            ->groupBy('product_id')->orderByDesc('units')->limit(10)->get();
        $images = Product::withTrashed()->with('media')->whereIn('id', $rows->pluck('product_id')->filter())->get()
            ->mapWithKeys(function (Product $p) {
                /** @var Media|null $media */
                $media = $p->media->first();

                return [$p->id => $media?->urls()];
            });

        return $rows->map(fn ($r) => [
            'product_id' => $r->product_id,
            'name' => $r->name,
            'units' => (int) $r->units,
            'orders' => (int) $r->orders,
            'revenue' => Money::toFloat(Money::toCents((string) $r->revenue)),
            'image' => $images[$r->product_id] ?? null,
        ])->all();
    }

    /**
     * @param  Collection<int, Order>  $orders
     * @return list<array{governorate: string, orders: int, revenue: float}>
     */
    private function governorates(Collection $orders): array
    {
        return $orders->filter(fn (Order $o) => $o->governorate !== null)->groupBy('governorate')
            ->map(fn ($group, $name) => ['governorate' => (string) $name, 'orders' => $group->count(), 'revenue' => Money::toFloat($group->sum(fn (Order $o) => Money::toCents((string) $o->total)))])
            ->sortByDesc('orders')->take(10)->values()->all();
    }

    /**
     * Orders per Cairo hour of the day (0..23).
     *
     * @param  Collection<int, Order>  $orders
     * @return list<int>
     */
    private function hours(Collection $orders): array
    {
        $hours = array_fill(0, 24, 0);
        foreach ($orders as $order) {
            $hours[(int) $order->created_at->setTimezone(self::TZ)->format('G')]++;
        }

        return $hours;
    }
}
