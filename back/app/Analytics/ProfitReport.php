<?php

declare(strict_types=1);

namespace App\Analytics;

use App\Enums\ExpenseKind;
use App\Enums\OrderStatus;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Support\Money;
use App\Support\TrafficSource;
use Carbon\CarbonImmutable;

/**
 * «الأرباح» of a period of Cairo days (orders by the day they were placed, expenses by the day they were spent):
 * the actual profit of what was delivered (returns and damaged parcels are its losses), the expected profit of the
 * orders still on their way, the expenses, the net, per day, per product and per ad source (ROAS). Read by the
 * dashboard page and the store copilot, so both always agree. Runs under the tenant scope.
 */
final class ProfitReport
{
    /** Still on their way: counted as expected profit (an unpaid online order is not counted until it is paid). */
    public const EXPECTED = [OrderStatus::New, OrderStatus::Confirmed, OrderStatus::Shipped];

    /** Reached the customer, or came back / broke on the way (a loss). */
    public const ACTUAL = [OrderStatus::Delivered, OrderStatus::Returned, OrderStatus::Damaged];

    public function __construct(private readonly OrderCosts $costs, private readonly SalesFigures $figures) {}

    /** @return array<string, mixed> money in pounds (floats), never cents */
    public function report(CarbonImmutable $from, CarbonImmutable $to, string $tz = 'Africa/Cairo'): array
    {
        $actual = $expected = self::emptyTotals();
        $days = [];
        for ($d = $from; $d->lessThanOrEqualTo($to); $d = $d->addDay()) {
            $days[$d->format('Y-m-d')] = ['profit' => 0, 'expenses' => 0];
        }
        $products = [];
        $sources = [];
        $missing = 0;

        $statuses = array_map(fn (OrderStatus $s) => $s->value, [...self::ACTUAL, ...self::EXPECTED]);
        $this->figures->between($from, $to)->whereIn('status', $statuses)->with('items')->lazyById(200)->each(
            function (Order $order) use (&$actual, &$expected, &$days, &$products, &$sources, &$missing, $tz): void {
                $p = $this->costs->profit($order);
                $missing += $p['cost_known'] ? 0 : 1;
                $isActual = in_array($order->status, self::ACTUAL, true);
                if (! $isActual) {
                    self::add($expected, $p);

                    return;
                }
                self::add($actual, $p);
                $day = $order->created_at->setTimezone($tz)->format('Y-m-d');
                if (isset($days[$day])) {
                    $days[$day]['profit'] += $p['profit'];
                }

                $utm = is_array($order->utm) ? $order->utm : [];
                $source = TrafficSource::classify($utm['source'] ?? null, $utm['referrer'] ?? null);
                $sources[$source] ??= ['orders' => 0, 'revenue' => 0, 'profit' => 0];
                $sources[$source]['orders'] += $order->status === OrderStatus::Delivered ? 1 : 0;
                $sources[$source]['revenue'] += $p['revenue'];
                $sources[$source]['profit'] += $p['profit'];

                if ($order->status !== OrderStatus::Delivered) {
                    return;
                }
                foreach ($order->items as $item) {
                    /** @var OrderItem $item */
                    $key = $item->product_id ?? 'x'.$item->product_name;
                    $products[$key] ??= ['product_id' => $item->product_id, 'name' => $item->product_name, 'units' => 0, 'revenue' => 0, 'cost' => 0, 'cost_known' => true];
                    $products[$key]['units'] += $item->quantity;
                    $products[$key]['revenue'] += Money::toCents((string) $item->line_total);
                    if ($item->unit_cost === null) {
                        $products[$key]['cost_known'] = false;
                    } else {
                        $products[$key]['cost'] += Money::toCents((string) $item->unit_cost) * $item->quantity;
                    }
                }
            },
        );

        // Expenses of the period, by kind and by day.
        $byKind = [];
        $expenses = 0;
        Expense::query()->where('spent_on', '>=', $from->format('Y-m-d'))->where('spent_on', '<=', $to->format('Y-m-d'))
            ->get(['spent_on', 'kind', 'amount'])->each(function (Expense $e) use (&$byKind, &$expenses, &$days): void {
                $cents = Money::toCents((string) $e->amount);
                $expenses += $cents;
                $byKind[$e->kind->value] = ($byKind[$e->kind->value] ?? 0) + $cents;
                $day = $e->spent_on->format('Y-m-d');
                if (isset($days[$day])) {
                    $days[$day]['expenses'] += $cents;
                }
            });

        $net = $actual['profit'] - $expenses;

        return [
            'from' => $from->format('Y-m-d'),
            'to' => $to->format('Y-m-d'),
            'actual' => self::totalsOut($actual),
            'expected' => self::totalsOut($expected),
            'expenses' => [
                'total' => Money::toFloat($expenses),
                'by_kind' => array_values(array_map(fn (ExpenseKind $k) => ['kind' => $k->value, 'label' => $k->label(), 'amount' => Money::toFloat($byKind[$k->value] ?? 0)], array_filter(ExpenseKind::cases(), fn (ExpenseKind $k) => isset($byKind[$k->value])))),
            ],
            'net_profit' => Money::toFloat($net),
            'margin' => $actual['revenue'] === 0 ? null : round($net * 100 / $actual['revenue'], 1),
            // Orders with a product that has no cost: their profit is overstated until the cost is set.
            'missing_cost_orders' => $missing,
            'chart' => array_map(fn (string $date, array $v) => ['date' => $date, 'profit' => Money::toFloat($v['profit']), 'expenses' => Money::toFloat($v['expenses']), 'net' => Money::toFloat($v['profit'] - $v['expenses'])], array_keys($days), array_values($days)),
            'products' => $this->productsOut($products),
            'sources' => $this->sourcesOut($sources, $byKind),
        ];
    }

    /** @return array{orders: int, revenue: int, product_cost: int, shipping_cost: int, cod_fee: int, packaging: int, losses: int, profit: int} */
    private static function emptyTotals(): array
    {
        return ['orders' => 0, 'revenue' => 0, 'product_cost' => 0, 'shipping_cost' => 0, 'cod_fee' => 0, 'packaging' => 0, 'losses' => 0, 'profit' => 0];
    }

    /**
     * @param  array<string, int>  $totals
     * @param  array<string, int|bool>  $p
     */
    private static function add(array &$totals, array $p): void
    {
        $totals['orders']++;
        $totals['revenue'] += (int) $p['revenue'];
        $totals['product_cost'] += (int) $p['product_cost'];
        $totals['shipping_cost'] += (int) $p['shipping_cost'];
        $totals['cod_fee'] += (int) $p['cod_fee'];
        $totals['packaging'] += (int) $p['packaging'];
        $totals['losses'] += (int) $p['loss'];
        $totals['profit'] += (int) $p['profit'];
    }

    /**
     * @param  array<string, int>  $totals
     * @return array<string, int|float>
     */
    private static function totalsOut(array $totals): array
    {
        $out = ['orders' => $totals['orders']];
        foreach (['revenue', 'product_cost', 'shipping_cost', 'cod_fee', 'packaging', 'losses', 'profit'] as $key) {
            $out[$key] = Money::toFloat($totals[$key]);
        }

        return $out;
    }

    /**
     * Most profitable first (20).
     *
     * @param  array<int|string, array{product_id: int|null, name: string, units: int, revenue: int, cost: int, cost_known: bool}>  $products
     * @return list<array<string, mixed>>
     */
    private function productsOut(array $products): array
    {
        $rows = array_map(fn (array $p) => $p + ['profit' => $p['revenue'] - $p['cost']], array_values($products));
        usort($rows, fn (array $a, array $b) => $b['profit'] <=> $a['profit']);

        return array_map(fn (array $p) => [
            'product_id' => $p['product_id'],
            'name' => $p['name'],
            'units' => $p['units'],
            'revenue' => Money::toFloat($p['revenue']),
            'cost' => Money::toFloat($p['cost']),
            'profit' => Money::toFloat($p['profit']),
            'margin' => $p['revenue'] === 0 ? null : round($p['profit'] * 100 / $p['revenue'], 1),
            'cost_known' => $p['cost_known'],
        ], array_slice($rows, 0, 20));
    }

    /**
     * Each traffic source's delivered orders and profit, with the ad spend recorded for it: ROAS = revenue / spend.
     *
     * @param  array<string, array{orders: int, revenue: int, profit: int}>  $sources
     * @param  array<string, int>  $byKind
     * @return list<array<string, mixed>>
     */
    private function sourcesOut(array $sources, array $byKind): array
    {
        $spend = [];
        foreach (ExpenseKind::cases() as $kind) {
            $mapped = $kind->sources();
            if ($mapped === [] || ! isset($byKind[$kind->value])) {
                continue;
            }
            // Spend of a kind with several sources (Meta = facebook + instagram) goes to the first one listed.
            $spend[$mapped[0]] = ($spend[$mapped[0]] ?? 0) + $byKind[$kind->value];
            foreach (array_slice($mapped, 1) as $also) {
                if (isset($sources[$also])) {
                    $sources[$mapped[0]] ??= ['orders' => 0, 'revenue' => 0, 'profit' => 0];
                    foreach (['orders', 'revenue', 'profit'] as $f) {
                        $sources[$mapped[0]][$f] += $sources[$also][$f];
                    }
                    unset($sources[$also]);
                }
            }
        }
        foreach (array_keys($spend) as $source) {
            $sources[$source] ??= ['orders' => 0, 'revenue' => 0, 'profit' => 0];
        }

        $rows = [];
        foreach ($sources as $source => $s) {
            $cost = $spend[$source] ?? 0;
            $rows[] = [
                'source' => $source,
                'orders' => $s['orders'],
                'revenue' => Money::toFloat($s['revenue']),
                'profit' => Money::toFloat($s['profit']),
                'ad_spend' => Money::toFloat($cost),
                'net' => Money::toFloat($s['profit'] - $cost),
                'roas' => $cost === 0 ? null : round($s['revenue'] / $cost, 2),
            ];
        }
        usort($rows, fn (array $a, array $b) => $b['revenue'] <=> $a['revenue']);

        return $rows;
    }
}
