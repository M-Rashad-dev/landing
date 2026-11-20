<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\Period;
use App\Ai\Copilot\Support\ReportResult;
use App\Analytics\SalesFigures;

/** Orders and sales per governorate of a period (the home page's query, all governorates). */
final class GovernoratesReport extends CopilotReport
{
    public function __construct(private readonly SalesFigures $sales) {}

    public function key(): string
    {
        return 'sales_by_governorate';
    }

    public function label(): string
    {
        return 'المبيعات حسب المحافظة';
    }

    public function summary(): string
    {
        return 'Orders and sales per governorate for a period, most orders first.';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => Period::schema()];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $period = Period::from($params);
        $rows = array_map(fn (array $r) => ['governorate' => $r['governorate'], 'orders' => $r['orders'], 'sales' => number_format($r['sales'], 2, '.', '')], $this->sales->topGovernorates($period->from, $period->to, 30));

        return new ReportResult(
            summary: ['period' => $period->toArray(), 'governorates' => $rows],
            title: 'المبيعات حسب المحافظة',
            columns: [['key' => 'governorate', 'label' => 'المحافظة', 'kind' => 'text'], ['key' => 'orders', 'label' => 'الطلبات', 'kind' => 'int'], ['key' => 'sales', 'label' => 'المبيعات', 'kind' => 'money']],
            rows: $rows,
        );
    }
}
