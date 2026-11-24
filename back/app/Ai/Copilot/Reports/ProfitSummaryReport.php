<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\Period;
use App\Ai\Copilot\Support\ReportResult;
use App\Analytics\ProfitReport;
use App\Support\CairoTime;

/** «الأرباح» of a period: the very numbers of the profit page (ProfitReport). */
final class ProfitSummaryReport extends CopilotReport
{
    public function __construct(private readonly ProfitReport $profit) {}

    public function key(): string
    {
        return 'profit_summary';
    }

    public function label(): string
    {
        return 'الأرباح';
    }

    public function summary(): string
    {
        return 'Profit of a period: actual (delivered orders, minus returns / damaged as losses), expected (orders still new / confirmed / shipped), product cost, real shipping cost, COD fee, packaging, expenses by kind (ads, salaries…), net profit and margin, most profitable products, ROAS per ad source, orders missing a product cost, refunds (money sent back to customers). Same numbers as the dashboard «الأرباح» page.';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => Period::schema()];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $period = Period::from($params);
        $r = $this->profit->report($period->from, $period->to, CairoTime::ZONE);
        $money = fn (float $v): string => number_format($v, 2, '.', '');

        return new ReportResult(
            summary: [
                'period' => $period->toArray(),
                'actual' => $r['actual'],
                'expected' => $r['expected'],
                'expenses' => $r['expenses'],
                'net_profit' => $r['net_profit'],
                'margin_percent' => $r['margin'],
                'missing_cost_orders' => $r['missing_cost_orders'],
                'sources' => $r['sources'],
                'refunds_done_in_period' => $r['refunds'],
                'rules' => 'Money in EGP. Actual profit = delivered revenue − refunds − product cost (units refunded back to stock no longer count) − real shipping − COD fee − packaging − losses (returned: shipping both ways + packaging; damaged: also the goods). Net = actual profit − expenses. Orders by the day placed, expenses by the day spent. Costs are snapshotted when an order is placed; a product without a cost counts as 0 (see missing_cost_orders).',
            ],
            title: 'أرباح المنتجات ('.$period->from->toDateString().' ← '.$period->to->toDateString().')',
            columns: [
                ['key' => 'name', 'label' => 'المنتج', 'kind' => 'text'],
                ['key' => 'units', 'label' => 'القطع', 'kind' => 'int'],
                ['key' => 'revenue', 'label' => 'المبيعات', 'kind' => 'money'],
                ['key' => 'cost', 'label' => 'التكلفة', 'kind' => 'money'],
                ['key' => 'profit', 'label' => 'الربح', 'kind' => 'money'],
            ],
            rows: array_map(fn (array $p) => ['name' => $p['name'], 'units' => $p['units'], 'revenue' => $money($p['revenue']), 'cost' => $money($p['cost']), 'profit' => $money($p['profit'])], $r['products']),
        );
    }
}
