<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\OrderStatus;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\StoreStat;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Store analytics (S10): visits, product views, add-to-cart, checkouts, orders and revenue
 * per Cairo day, traffic sources and best-selling products. First-party counters only.
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

        $stats = StoreStat::query()
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get(['date', 'source', 'device', 'views', 'product_views', 'add_to_cart', 'checkouts']);

        $orders = Order::query()
            ->where('source', 'store')
            ->whereNotIn('status', [OrderStatus::Cancelled, OrderStatus::Fake])
            ->whereBetween('created_at', [$from->startOfDay()->utc(), $to->endOfDay()->utc()])
            ->get(['id', 'total', 'created_at']);

        $days = [];
        for ($d = $from; $d->lte($to); $d = $d->addDay()) {
            $days[$d->toDateString()] = ['date' => $d->toDateString(), 'views' => 0, 'product_views' => 0, 'add_to_cart' => 0, 'checkouts' => 0, 'orders' => 0, 'revenue' => 0];
        }
        $sources = [];
        foreach ($stats as $row) {
            $day = $row->date->toDateString();
            foreach (['views', 'product_views', 'add_to_cart', 'checkouts'] as $k) {
                $days[$day][$k] += (int) $row->{$k};
            }
            $sources[$row->source] = ($sources[$row->source] ?? 0) + (int) $row->views;
        }
        foreach ($orders as $order) {
            $day = $order->created_at->setTimezone(self::TZ)->toDateString();
            if (isset($days[$day])) {
                $days[$day]['orders']++;
                $days[$day]['revenue'] += Money::toCents((string) $order->total);
            }
        }

        $totals = ['views' => 0, 'product_views' => 0, 'add_to_cart' => 0, 'checkouts' => 0, 'orders' => 0, 'revenue' => 0];
        foreach ($days as $day) {
            foreach ($totals as $k => $_) {
                $totals[$k] += $day[$k];
            }
        }

        $top = OrderItem::query()
            ->whereIn('order_id', $orders->pluck('id'))
            ->where('is_gift', false)
            ->selectRaw('product_id, max(product_name) as name, sum(quantity) as units, sum(line_total) as revenue')
            ->groupBy('product_id')
            ->orderByDesc('units')
            ->limit(10)
            ->get();

        return $this->ok([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'totals' => ['revenue' => Money::toFloat($totals['revenue']), 'conversion' => $totals['views'] > 0 ? round($totals['orders'] * 100 / $totals['views'], 2) : null] + $totals,
            'days' => array_values(array_map(fn (array $d) => ['revenue' => Money::toFloat($d['revenue'])] + $d, $days)),
            'sources' => collect($sources)->sortDesc()->map(fn ($views, $source) => ['source' => $source, 'views' => $views])->values()->all(),
            'top_products' => $top->map(fn ($r) => ['product_id' => $r->product_id, 'name' => $r->name, 'units' => (int) $r->units, 'revenue' => Money::toFloat(Money::toCents((string) $r->revenue))])->all(),
        ]);
    }
}
