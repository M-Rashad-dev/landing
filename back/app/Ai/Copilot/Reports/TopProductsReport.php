<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\Period;
use App\Ai\Copilot\Support\ReportResult;
use App\Analytics\SalesFigures;

/** Best sellers of a period by units (gifts left out), the home page's own query with a bigger limit. */
final class TopProductsReport extends CopilotReport
{
    public function __construct(private readonly SalesFigures $sales) {}

    public function key(): string
    {
        return 'top_products';
    }

    public function label(): string
    {
        return 'أكتر المنتجات مبيعاً';
    }

    public function summary(): string
    {
        return 'Best-selling products of a period: units sold and sales (cancelled / fake orders and gifts left out).';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => Period::schema() + ['limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 50, 'description' => 'Default 10.']]];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $period = Period::from($params);
        $limit = max(1, min(50, (int) ($params['limit'] ?? 10)));
        $rows = array_map(fn (array $r) => ['name' => $r['name'], 'units' => $r['units'], 'sales' => number_format($r['sales'], 2, '.', '')], $this->sales->topProducts($period->from, $period->to, $limit));

        return new ReportResult(
            summary: ['period' => $period->toArray(), 'products' => $rows],
            title: 'أكتر المنتجات مبيعاً',
            columns: [['key' => 'name', 'label' => 'المنتج', 'kind' => 'text'], ['key' => 'units', 'label' => 'القطع', 'kind' => 'int'], ['key' => 'sales', 'label' => 'المبيعات', 'kind' => 'money']],
            rows: $rows,
        );
    }
}
