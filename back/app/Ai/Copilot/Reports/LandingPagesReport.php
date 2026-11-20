<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\Period;
use App\Ai\Copilot\Support\ReportResult;
use App\Enums\PlanFeature;
use App\Services\PageAnalytics;

/** Landing pages' visits, form starts, orders and conversion: the landing analytics page's own report (PageAnalytics). */
final class LandingPagesReport extends CopilotReport
{
    public function __construct(private readonly PageAnalytics $analytics) {}

    public function key(): string
    {
        return 'landing_pages';
    }

    public function label(): string
    {
        return 'أداء صفحات الهبوط';
    }

    public function summary(): string
    {
        return 'Landing pages for a period: visits, form starts, orders, sales and conversion, in total and per page, plus traffic sources and devices.';
    }

    public function available(CopilotContext $ctx): bool
    {
        // The landing analytics page needs this plan feature too.
        return $ctx->allows(PlanFeature::AdvancedAnalytics);
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => Period::schema()];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $period = Period::from($params);
        $report = $this->analytics->report($period->from, $period->to);
        $rows = array_map(fn (array $p) => [
            'title' => $p['title'],
            'views' => $p['views'],
            'form_starts' => $p['form_starts'],
            'orders' => $p['orders'],
            'revenue' => number_format((float) $p['revenue'], 2, '.', ''),
            'conversion' => $p['conversion'] === null ? '' : $p['conversion'].'%',
        ], $report['pages']);

        return new ReportResult(
            summary: ['period' => $period->toArray(), 'totals' => $report['totals'], 'pages' => array_slice($rows, 0, 30), 'sources' => $report['sources'], 'devices' => $report['devices'], 'rules' => 'Conversion counts orders of pages with tracked visits; in %.'],
            title: 'أداء صفحات الهبوط',
            columns: [
                ['key' => 'title', 'label' => 'الصفحة', 'kind' => 'text'],
                ['key' => 'views', 'label' => 'الزيارات', 'kind' => 'int'],
                ['key' => 'form_starts', 'label' => 'بدأوا الفورم', 'kind' => 'int'],
                ['key' => 'orders', 'label' => 'الطلبات', 'kind' => 'int'],
                ['key' => 'revenue', 'label' => 'المبيعات', 'kind' => 'money'],
                ['key' => 'conversion', 'label' => 'التحويل', 'kind' => 'text'],
            ],
            rows: $rows,
        );
    }
}
