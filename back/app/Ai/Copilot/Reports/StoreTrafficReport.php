<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\Period;
use App\Ai\Copilot\Support\ReportResult;
use App\Analytics\StoreTraffic;

/** The store's visits and purchase funnel: the analytics page's own numbers (StoreTraffic). Store orders only. */
final class StoreTrafficReport extends CopilotReport
{
    public function __construct(private readonly StoreTraffic $traffic) {}

    public function key(): string
    {
        return 'store_traffic';
    }

    public function label(): string
    {
        return 'زيارات المتجر والتحويل';
    }

    public function summary(): string
    {
        return 'Online store only: visits, product views, add to cart, checkouts, orders, conversion rates, traffic sources, devices, new vs returning customers, abandoned carts, order hours, with the period before. Same numbers as the analytics page.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return $ctx->hasStore();
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => Period::schema()];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $period = Period::from($params);
        $report = $this->traffic->report($period->from, $period->to);
        $hours = $report['hours'];
        arsort($hours);

        return new ReportResult(
            summary: [
                'period' => $report['range'],
                'figures' => $report['totals'],
                'previous_figures' => $report['previous'],
                'sources' => $report['sources'],
                'devices' => $report['devices'],
                'busiest_hours' => array_slice(array_keys($hours), 0, 3),
                'rules' => 'Store orders only; cancelled and fake left out. Rates in %. Hours are Cairo time (0–23).',
            ],
            title: 'زيارات المتجر يوم بيوم',
            columns: [
                ['key' => 'date', 'label' => 'اليوم', 'kind' => 'date'],
                ['key' => 'views', 'label' => 'الزيارات', 'kind' => 'int'],
                ['key' => 'add_to_cart', 'label' => 'إضافة للسلة', 'kind' => 'int'],
                ['key' => 'orders', 'label' => 'الطلبات', 'kind' => 'int'],
                ['key' => 'revenue', 'label' => 'المبيعات', 'kind' => 'money'],
            ],
            rows: array_map(fn (array $d) => ['date' => $d['date'], 'views' => $d['views'], 'add_to_cart' => $d['add_to_cart'], 'orders' => $d['orders'], 'revenue' => number_format((float) $d['revenue'], 2, '.', '')], $report['days']),
        );
    }
}
