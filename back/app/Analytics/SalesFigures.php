<?php

declare(strict_types=1);

namespace App\Analytics;

use App\Enums\OrderStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Support\Money;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * The sales numbers of a period of Cairo days, over every order (store and landing pages): the figures «الرئيسية»
 * shows and the store copilot reports, from one place so they never differ. Cancelled and fake orders are not sales.
 * Dates are Cairo days at midnight (from and to included). Runs under the tenant scope.
 */
final class SalesFigures
{
    /** Statuses that are not a sale (left out of sales and averages). */
    public const NOT_SALES = [OrderStatus::Cancelled, OrderStatus::Fake];

    /** Orders past confirmation (the call succeeded). */
    public const CONFIRMED = [OrderStatus::Confirmed, OrderStatus::Shipped, OrderStatus::Delivered, OrderStatus::Returned, OrderStatus::Damaged];

    /** @return Builder<Order> */
    public function between(CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return Order::query()->where('created_at', '>=', $from->utc())->where('created_at', '<', $to->addDay()->utc());
    }

    /** @return array<string, int|float> */
    public function kpis(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = $this->between($from, $to)->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');
        $n = fn (OrderStatus ...$statuses): int => array_sum(array_map(fn (OrderStatus $s) => (int) ($counts[$s->value] ?? 0), $statuses));

        $sales = $this->between($from, $to)->whereNotIn('status', self::notSales())->sum('total');
        $delivered = $this->between($from, $to)->where('status', OrderStatus::Delivered)->sum('total');
        $all = (int) $counts->sum();
        $real = $all - $n(...self::NOT_SALES);
        $decided = $all - $n(OrderStatus::New);
        $outcomes = $n(OrderStatus::Delivered, OrderStatus::Returned, OrderStatus::Damaged);

        return [
            'orders' => $all,
            'sales' => Money::toFloat(Money::toCents((string) ($sales ?: '0'))),
            'delivered_sales' => Money::toFloat(Money::toCents((string) ($delivered ?: '0'))),
            'average_order' => $real === 0 ? 0.0 : round(Money::toCents((string) ($sales ?: '0')) / $real / 100, 2),
            // Of the orders already called (not new any more), how many were confirmed.
            'confirmation_rate' => $decided === 0 ? 0.0 : round($n(...self::CONFIRMED) * 100 / $decided, 1),
            // Of the orders that reached an end on delivery, how many were received / sent back.
            'delivery_rate' => $outcomes === 0 ? 0.0 : round($n(OrderStatus::Delivered) * 100 / $outcomes, 1),
            'return_rate' => $outcomes === 0 ? 0.0 : round($n(OrderStatus::Returned, OrderStatus::Damaged) * 100 / $outcomes, 1),
            'new_customers' => Customer::query()->where('first_order_at', '>=', $from->utc())->where('first_order_at', '<', $to->addDay()->utc())->count(),
        ];
    }

    /** @return list<array{date: string, orders: int, sales: float}> */
    public function chart(CarbonImmutable $from, CarbonImmutable $to, string $tz): array
    {
        $days = [];
        for ($d = $from; $d->lessThanOrEqualTo($to); $d = $d->addDay()) {
            $days[$d->format('Y-m-d')] = ['orders' => 0, 'sales' => 0];
        }
        // Grouped in PHP on the Cairo day (portable across MySQL / MariaDB).
        $this->between($from, $to)->get(['created_at', 'total', 'status'])->each(function (Order $o) use (&$days, $tz): void {
            $day = $o->created_at->setTimezone($tz)->format('Y-m-d');
            if (! isset($days[$day])) {
                return;
            }
            $days[$day]['orders']++;
            if (! in_array($o->status, self::NOT_SALES, true)) {
                $days[$day]['sales'] += Money::toCents((string) $o->total);
            }
        });

        return array_map(fn (string $date, array $v) => ['date' => $date, 'orders' => $v['orders'], 'sales' => Money::toFloat($v['sales'])], array_keys($days), array_values($days));
    }

    /** @return array<string, int> */
    public function statuses(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = $this->between($from, $to)->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');

        return collect(OrderStatus::cases())->mapWithKeys(fn (OrderStatus $s) => [$s->value => (int) ($counts[$s->value] ?? 0)])->all();
    }

    /** @return list<array{product_id: int|null, name: string, units: int, sales: float}> */
    public function topProducts(CarbonImmutable $from, CarbonImmutable $to, int $limit = 5): array
    {
        $orderIds = $this->between($from, $to)->whereNotIn('status', self::notSales())->select('id');

        return OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->where('is_gift', false)
            ->selectRaw('product_id, max(product_name) as name, sum(quantity) as units, sum(line_total) as sales')
            ->groupBy('product_id')
            ->orderByDesc('units')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => ['product_id' => $row->product_id === null ? null : (int) $row->product_id, 'name' => (string) $row->name, 'units' => (int) $row->units, 'sales' => Money::toFloat(Money::toCents((string) $row->sales))])
            ->values()
            ->all();
    }

    /** @return list<array{governorate: string, orders: int, sales: float}> */
    public function topGovernorates(CarbonImmutable $from, CarbonImmutable $to, int $limit = 6): array
    {
        return $this->between($from, $to)
            ->whereNotIn('status', self::notSales())
            ->whereNotNull('governorate')
            ->selectRaw('governorate, count(*) as orders, sum(total) as sales')
            ->groupBy('governorate')
            ->orderByDesc('orders')
            ->limit($limit)
            ->get()
            ->map(fn ($row) => ['governorate' => (string) $row->governorate, 'orders' => (int) $row->orders, 'sales' => Money::toFloat(Money::toCents((string) $row->sales))])
            ->values()
            ->all();
    }

    /** @return array{store: array{orders: int, sales: float}, landing: array{orders: int, sales: float}} */
    public function sources(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = $this->between($from, $to)->whereNotIn('status', self::notSales())
            ->selectRaw("case when source = 'store' then 'store' else 'landing' end as kind, count(*) as orders, sum(total) as sales")
            ->groupBy('kind')->get()->keyBy('kind');
        $row = fn (string $kind) => ['orders' => (int) ($rows[$kind]->orders ?? 0), 'sales' => Money::toFloat(Money::toCents((string) ($rows[$kind]->sales ?? '0')))];

        return ['store' => $row('store'), 'landing' => $row('landing')];
    }

    /** @return list<string> */
    private static function notSales(): array
    {
        return array_map(fn (OrderStatus $s) => $s->value, self::NOT_SALES);
    }
}
