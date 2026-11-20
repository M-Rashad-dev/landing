<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\Period;
use App\Ai\Copilot\Support\ReportResult;
use App\Analytics\SalesFigures;
use App\Enums\OrderStatus;
use App\Support\CairoTime;

/** The sales of a period with the period before it: the very numbers of «الرئيسية» (SalesFigures). */
final class SalesSummaryReport extends CopilotReport
{
    public function __construct(private readonly SalesFigures $sales) {}

    public function key(): string
    {
        return 'sales_summary';
    }

    public function label(): string
    {
        return 'ملخص المبيعات';
    }

    public function summary(): string
    {
        return 'Orders, sales, delivered sales, average order, confirmation / delivery / return rates, new customers, orders per status, store vs landing pages, for a period and the period just before it. Same numbers as the dashboard home.';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => Period::schema()];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $period = Period::from($params);
        $days = $period->days();
        $previousTo = $period->from->subDay();
        $previousFrom = $previousTo->subDays($days - 1);
        $statuses = $this->sales->statuses($period->from, $period->to);

        $rows = array_map(fn (array $d) => ['date' => $d['date'], 'orders' => $d['orders'], 'sales' => number_format($d['sales'], 2, '.', '')], $this->sales->chart($period->from, $period->to, CairoTime::ZONE));

        return new ReportResult(
            summary: [
                'period' => $period->toArray(),
                'figures' => $this->sales->kpis($period->from, $period->to),
                'previous_period' => ['from' => $previousFrom->toDateString(), 'to' => $previousTo->toDateString()],
                'previous_figures' => $this->sales->kpis($previousFrom, $previousTo),
                'orders_by_status' => array_combine(array_map(fn (string $s) => OrderStatus::from($s)->label(), array_keys($statuses)), array_values($statuses)),
                'by_source' => $this->sales->sources($period->from, $period->to),
                'rules' => 'Sales = every order except cancelled and fake. Money in EGP. Rates in %.',
            ],
            title: 'المبيعات يوم بيوم ('.$period->from->toDateString().' ← '.$period->to->toDateString().')',
            columns: [['key' => 'date', 'label' => 'اليوم', 'kind' => 'date'], ['key' => 'orders', 'label' => 'الطلبات', 'kind' => 'int'], ['key' => 'sales', 'label' => 'المبيعات', 'kind' => 'money']],
            rows: $rows,
        );
    }
}
