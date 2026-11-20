<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Reports;

use App\Ai\Copilot\Contracts\CopilotReport;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\Period;
use App\Ai\Copilot\Support\ReportResult;
use App\Analytics\SalesFigures;
use App\Enums\OrderStatus;
use App\Models\DiscountCode;
use App\Models\Offer;
use App\Support\Money;

/**
 * How coupons and offers did in a period: orders that used each one, the discount given and the sales they brought
 * (cancelled and fake orders left out, like every sales number).
 */
final class PromotionsReport extends CopilotReport
{
    public function __construct(private readonly SalesFigures $sales) {}

    public function key(): string
    {
        return 'promotions_performance';
    }

    public function label(): string
    {
        return 'أداء الكوبونات والعروض';
    }

    public function summary(): string
    {
        return 'For a period: each coupon code and offer with the orders that used it, the discount given and their sales; plus times used in total.';
    }

    public function params(): array
    {
        return ['type' => 'object', 'properties' => Period::schema()];
    }

    public function run(array $params, CopilotContext $ctx): ReportResult
    {
        $period = Period::from($params);
        $notSales = array_map(fn (OrderStatus $s) => $s->value, SalesFigures::NOT_SALES);
        $orders = fn () => $this->sales->between($period->from, $period->to)->whereNotIn('status', $notSales);

        $byCode = $orders()->whereNotNull('discount_code_id')
            ->selectRaw('discount_code_id as id, count(*) as orders, sum(code_discount) as discount, sum(total) as sales')
            ->groupBy('discount_code_id')->get()->keyBy('id');
        $byOffer = $orders()->whereNotNull('offer_id')
            ->selectRaw('offer_id as id, count(*) as orders, sum(offer_discount) as discount, sum(total) as sales')
            ->groupBy('offer_id')->get()->keyBy('id');

        $money = fn ($v) => Money::toDecimal(Money::toCents((string) ($v ?? '0')));
        $rows = [];
        foreach (DiscountCode::query()->orderByDesc('used_count')->limit(200)->get() as $code) {
            $row = $byCode->get($code->id);
            $rows[] = ['kind' => 'كوبون', 'name' => $code->code, 'active' => $code->is_active ? 'نعم' : 'لا', 'orders' => (int) ($row->orders ?? 0), 'discount' => $money($row->discount ?? null), 'sales' => $money($row->sales ?? null), 'used_total' => (int) $code->used_count];
        }
        foreach (Offer::query()->orderByDesc('priority')->limit(200)->get() as $offer) {
            $row = $byOffer->get($offer->id);
            $rows[] = ['kind' => 'عرض', 'name' => $offer->name, 'active' => $offer->is_active ? 'نعم' : 'لا', 'orders' => (int) ($row->orders ?? 0), 'discount' => $money($row->discount ?? null), 'sales' => $money($row->sales ?? null), 'used_total' => null];
        }
        usort($rows, fn (array $a, array $b) => $b['orders'] <=> $a['orders']);

        return new ReportResult(
            summary: ['period' => $period->toArray(), 'promotions' => array_slice($rows, 0, 30)],
            title: 'أداء الكوبونات والعروض',
            columns: [
                ['key' => 'kind', 'label' => 'النوع', 'kind' => 'text'],
                ['key' => 'name', 'label' => 'الاسم', 'kind' => 'text'],
                ['key' => 'active', 'label' => 'شغال', 'kind' => 'text'],
                ['key' => 'orders', 'label' => 'طلبات الفترة', 'kind' => 'int'],
                ['key' => 'discount', 'label' => 'الخصم', 'kind' => 'money'],
                ['key' => 'sales', 'label' => 'المبيعات', 'kind' => 'money'],
                ['key' => 'used_total', 'label' => 'اتستخدم كلياً', 'kind' => 'int'],
            ],
            rows: $rows,
        );
    }
}
