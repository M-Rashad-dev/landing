<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ReportResult;
use App\Models\Customer;
use App\Support\CustomerFilters;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

/**
 * Customers who ordered twice or more (the customers page's «بيرجعوا» segment). The model gets first names and
 * numbers only; the merchant's table has names and phones.
 */
final class RepeatCustomersReport extends CopilotReport
{
    public function key(): string
    {
        return 'repeat_customers';
    }

    public function label(): string
    {
        return 'العملاء اللي بيرجعوا يشتروا';
    }

    public function summary(): string
    {
        return 'Repeat customers (2+ orders): how many, and the best ones by orders or by spent (delivered orders).';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => [
            'sort' => ['type' => 'string', 'enum' => ['orders', 'spent'], 'description' => 'Default orders.'],
            'limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 200, 'description' => 'Default 20.'],
        ]];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $sort = ($params['sort'] ?? 'orders') === 'spent' ? 'spent' : 'orders';
        $limit = max(1, min(200, (int) ($params['limit'] ?? 20)));
        $query = CustomerFilters::apply(['segment' => 'repeat', 'sort' => $sort]);
        // The inner query carries the tenant scope; the outer one only counts its rows (like the customers page).
        $total = DB::query()->fromSub(CustomerFilters::apply(['segment' => 'repeat']), 'c')->count();
        $all = Customer::query()->count();

        $rows = $query->limit($limit)->get()->map(fn (Customer $c) => [
            'name' => (string) $c->name,
            'phone' => $c->phone,
            'orders' => (int) $c->getAttribute('orders_count'),
            'delivered' => (int) $c->getAttribute('delivered_count'),
            'spent' => Money::toDecimal(Money::toCents((string) ($c->getAttribute('spent') ?? '0'))),
        ])->all();

        return new ReportResult(
            summary: [
                'repeat_customers' => $total,
                'all_customers' => $all,
                'repeat_share_percent' => $all > 0 ? round($total * 100 / $all, 1) : 0,
                'top' => array_map(fn (array $r) => ['first_name' => explode(' ', trim($r['name']))[0], 'orders' => $r['orders'], 'spent' => $r['spent']], array_slice($rows, 0, 10)),
            ],
            title: 'العملاء اللي بيرجعوا يشتروا',
            columns: [
                ['key' => 'name', 'label' => 'الاسم', 'kind' => 'text'],
                ['key' => 'phone', 'label' => 'الموبايل', 'kind' => 'text'],
                ['key' => 'orders', 'label' => 'الطلبات', 'kind' => 'int'],
                ['key' => 'delivered', 'label' => 'اتسلّمت', 'kind' => 'int'],
                ['key' => 'spent', 'label' => 'اشترى بـ', 'kind' => 'money'],
            ],
            rows: $rows,
        );
    }
}
