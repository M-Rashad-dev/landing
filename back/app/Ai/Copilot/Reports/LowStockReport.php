<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\ReportResult;
use App\Models\Product;
use App\Store\ProductList;

/** Products out of stock and running low: the products page's «خلص» / «قرب يخلص» tabs (ProductList). */
final class LowStockReport extends CopilotReport
{
    public function __construct(private readonly ProductList $products) {}

    public function key(): string
    {
        return 'low_stock';
    }

    public function label(): string
    {
        return 'المنتجات اللي خلصت أو قربت تخلص';
    }

    public function summary(): string
    {
        return 'Products out of stock and products at or under their low-stock alert (default 5), variant products included.';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => ['limit' => ['type' => 'integer', 'minimum' => 1, 'maximum' => 200, 'description' => 'Rows per list, default 50.']]];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $limit = max(1, min(200, (int) ($params['limit'] ?? 50)));
        $row = fn (Product $p, string $state) => [
            'name' => $p->name,
            'state' => $state,
            'stock' => $p->stock_mode === Product::STOCK_VARIANT ? (int) $p->getAttribute('variants_sum_stock') : (int) $p->stock,
            'mode' => $p->stock_mode === Product::STOCK_VARIANT ? 'لكل اختيار' : 'للمنتج',
            'active' => $p->is_active ? 'نعم' : 'لا',
        ];
        $list = fn (string $status) => $this->products->query(['status' => $status, 'sort' => 'name'])->withSum('variants', 'stock')->limit($limit)->get();

        $out = $list('out')->map(fn (Product $p) => $row($p, 'خلص'))->all();
        $low = $list('low')->map(fn (Product $p) => $row($p, 'قرب يخلص'))->all();
        $counts = $this->products->counts([]);

        return new ReportResult(
            summary: ['out_of_stock' => $counts['out'], 'low' => $counts['low'], 'first_out' => array_slice($out, 0, 20), 'first_low' => array_slice($low, 0, 20)],
            title: 'المنتجات اللي خلصت أو قربت تخلص',
            columns: [
                ['key' => 'name', 'label' => 'المنتج', 'kind' => 'text'],
                ['key' => 'state', 'label' => 'الحالة', 'kind' => 'text'],
                ['key' => 'stock', 'label' => 'المخزون', 'kind' => 'int'],
                ['key' => 'mode', 'label' => 'نوع المخزون', 'kind' => 'text'],
                ['key' => 'active', 'label' => 'شغال', 'kind' => 'text'],
            ],
            rows: [...$out, ...$low],
        );
    }
}
