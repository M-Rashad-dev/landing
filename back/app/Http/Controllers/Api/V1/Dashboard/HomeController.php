<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Billing\Entitlements;
use App\Enums\DomainType;
use App\Enums\LeadStatus;
use App\Enums\OrderStatus;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\AbandonedLead;
use App\Models\Customer;
use App\Models\DiscountCode;
use App\Models\Domain;
use App\Models\Offer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ShippingCompany;
use App\Models\ShippingOffer;
use App\Models\ShippingSetting;
use App\Models\Store;
use App\Models\Tenant;
use App\Store\ProductList;
use App\Store\StoreSetup;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * «الرئيسية»: the numbers of a period (Cairo days, default the last 30) compared with the period
 * just before it, the chart, best sellers and governorates, what needs the merchant now, and the
 * store setup steps.
 */
final class HomeController extends Controller
{
    use RespondsWithJson;

    public const DEFAULT_DAYS = 30;

    public const MAX_DAYS = 366;

    /** Statuses that are not a sale (left out of sales and averages). */
    private const NOT_SALES = [OrderStatus::Cancelled, OrderStatus::Fake];

    /** Orders past confirmation (the call succeeded). */
    private const CONFIRMED = [OrderStatus::Confirmed, OrderStatus::Shipped, OrderStatus::Delivered, OrderStatus::Returned, OrderStatus::Damaged];

    public function __invoke(Request $request, Entitlements $entitlements, StoreSetup $setup, ProductList $products): JsonResponse
    {
        $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d']]);
        $tz = (string) config('landing.display_timezone');
        $today = CarbonImmutable::now($tz)->startOfDay();

        $to = $request->filled('to') ? CarbonImmutable::createFromFormat('Y-m-d', (string) $request->query('to'), $tz)->startOfDay() : $today;
        $from = $request->filled('from') ? CarbonImmutable::createFromFormat('Y-m-d', (string) $request->query('from'), $tz)->startOfDay() : $to->subDays(self::DEFAULT_DAYS - 1);
        if ($from->greaterThan($to)) {
            throw ValidationException::withMessages(['from' => [__('analytics.range_order')]]);
        }
        $days = (int) $from->diffInDays($to) + 1;
        if ($days > self::MAX_DAYS) {
            throw ValidationException::withMessages(['from' => [__('analytics.range_too_long', ['days' => self::MAX_DAYS])]]);
        }
        $prevTo = $from->subDay();
        $prevFrom = $prevTo->subDays($days - 1);

        return $this->ok([
            'range' => ['from' => $from->format('Y-m-d'), 'to' => $to->format('Y-m-d'), 'days' => $days, 'previous_from' => $prevFrom->format('Y-m-d'), 'previous_to' => $prevTo->format('Y-m-d')],
            'kpis' => $this->kpis($from, $to),
            'previous' => $this->kpis($prevFrom, $prevTo),
            'chart' => $this->chart($from, $to, $tz),
            'statuses' => $this->statuses($from, $to),
            'top_products' => $this->topProducts($from, $to),
            'top_governorates' => $this->topGovernorates($from, $to),
            'sources' => $this->sources($from, $to),
            'latest_orders' => OrderResource::collection(Order::query()->with('items:id,order_id,product_name,quantity,is_gift')->orderByDesc('order_number')->limit(6)->get())->resolve($request),
            'todo' => $this->todo($entitlements, $products),
            'setup' => $this->setupSteps($entitlements, $setup),
        ]);
    }

    /** @return Builder<Order> */
    private function between(CarbonImmutable $from, CarbonImmutable $to): Builder
    {
        return Order::query()->where('created_at', '>=', $from->utc())->where('created_at', '<', $to->addDay()->utc());
    }

    /** @return array<string, int|float> */
    private function kpis(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = $this->between($from, $to)->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');
        $n = fn (OrderStatus ...$statuses): int => array_sum(array_map(fn (OrderStatus $s) => (int) ($counts[$s->value] ?? 0), $statuses));

        $sales = $this->between($from, $to)->whereNotIn('status', array_map(fn ($s) => $s->value, self::NOT_SALES))->sum('total');
        $delivered = $this->between($from, $to)->where('status', OrderStatus::Delivered)->sum('total');
        $all = (int) $counts->sum();
        $real = $all - $n(...self::NOT_SALES);
        $decided = $all - $n(OrderStatus::New);
        $outcomes = $n(OrderStatus::Delivered, OrderStatus::Returned, OrderStatus::Damaged);

        return [
            'orders' => $all,
            'sales' => Money::toFloat(Money::toCents((string) ($sales ?: '0'))),
            'delivered_sales' => Money::toFloat(Money::toCents((string) ($delivered ?: '0'))),
            'average_order' => $real === 0 ? 0.0 : round(Money::toCents((string) ($sales ?: '0')) / $real / 100, 2),
            // Of the orders already called (not new any more), how many were confirmed.
            'confirmation_rate' => $decided === 0 ? 0.0 : round($n(...self::CONFIRMED) * 100 / $decided, 1),
            // Of the orders that reached an end on delivery, how many were received / sent back.
            'delivery_rate' => $outcomes === 0 ? 0.0 : round($n(OrderStatus::Delivered) * 100 / $outcomes, 1),
            'return_rate' => $outcomes === 0 ? 0.0 : round($n(OrderStatus::Returned, OrderStatus::Damaged) * 100 / $outcomes, 1),
            'new_customers' => Customer::query()->where('first_order_at', '>=', $from->utc())->where('first_order_at', '<', $to->addDay()->utc())->count(),
        ];
    }

    /** @return list<array{date: string, orders: int, sales: float}> */
    private function chart(CarbonImmutable $from, CarbonImmutable $to, string $tz): array
    {
        $days = [];
        for ($d = $from; $d->lessThanOrEqualTo($to); $d = $d->addDay()) {
            $days[$d->format('Y-m-d')] = ['orders' => 0, 'sales' => 0];
        }
        // Grouped in PHP on the Cairo day (portable across MySQL / MariaDB).
        $this->between($from, $to)->get(['created_at', 'total', 'status'])->each(function (Order $o) use (&$days, $tz): void {
            $day = $o->created_at->setTimezone($tz)->format('Y-m-d');
            if (! isset($days[$day])) {
                return;
            }
            $days[$day]['orders']++;
            if (! in_array($o->status, self::NOT_SALES, true)) {
                $days[$day]['sales'] += Money::toCents((string) $o->total);
            }
        });

        return array_map(fn (string $date, array $v) => ['date' => $date, 'orders' => $v['orders'], 'sales' => Money::toFloat($v['sales'])], array_keys($days), array_values($days));
    }

    /** @return array<string, int> */
    private function statuses(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $counts = $this->between($from, $to)->selectRaw('status, count(*) as aggregate')->groupBy('status')->pluck('aggregate', 'status');

        return collect(OrderStatus::cases())->mapWithKeys(fn (OrderStatus $s) => [$s->value => (int) ($counts[$s->value] ?? 0)])->all();
    }

    /** @return list<array{product_id: int|null, name: string, units: int, sales: float}> */
    private function topProducts(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $orderIds = $this->between($from, $to)->whereNotIn('status', array_map(fn ($s) => $s->value, self::NOT_SALES))->select('id');

        return OrderItem::query()
            ->whereIn('order_id', $orderIds)
            ->where('is_gift', false)
            ->selectRaw('product_id, max(product_name) as name, sum(quantity) as units, sum(line_total) as sales')
            ->groupBy('product_id')
            ->orderByDesc('units')
            ->limit(5)
            ->get()
            ->map(fn ($row) => ['product_id' => $row->product_id === null ? null : (int) $row->product_id, 'name' => (string) $row->name, 'units' => (int) $row->units, 'sales' => Money::toFloat(Money::toCents((string) $row->sales))])
            ->values()
            ->all();
    }

    /** @return list<array{governorate: string, orders: int, sales: float}> */
    private function topGovernorates(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->between($from, $to)
            ->whereNotIn('status', array_map(fn ($s) => $s->value, self::NOT_SALES))
            ->whereNotNull('governorate')
            ->selectRaw('governorate, count(*) as orders, sum(total) as sales')
            ->groupBy('governorate')
            ->orderByDesc('orders')
            ->limit(6)
            ->get()
            ->map(fn ($row) => ['governorate' => (string) $row->governorate, 'orders' => (int) $row->orders, 'sales' => Money::toFloat(Money::toCents((string) $row->sales))])
            ->values()
            ->all();
    }

    /** @return array{store: array{orders: int, sales: float}, landing: array{orders: int, sales: float}} */
    private function sources(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $rows = $this->between($from, $to)->whereNotIn('status', array_map(fn ($s) => $s->value, self::NOT_SALES))
            ->selectRaw("case when source = 'store' then 'store' else 'landing' end as kind, count(*) as orders, sum(total) as sales")
            ->groupBy('kind')->get()->keyBy('kind');
        $row = fn (string $kind) => ['orders' => (int) ($rows[$kind]->orders ?? 0), 'sales' => Money::toFloat(Money::toCents((string) ($rows[$kind]->sales ?? '0')))];

        return ['store' => $row('store'), 'landing' => $row('landing')];
    }

    /** What needs the merchant now (not tied to the period). @return array<string, int|null> */
    private function todo(Entitlements $entitlements, ProductList $products): array
    {
        $now = now();
        $soon = $now->copy()->addDays(3);
        $ending = fn (Builder $q) => $q->where('is_active', true)->whereNotNull('ends_at')->whereBetween('ends_at', [$now, $soon])->count();
        $stock = $products->counts([]);

        return [
            'to_confirm' => Order::query()->where('status', OrderStatus::New)->where(fn ($q) => $q->whereNull('follow_up_at')->orWhere('follow_up_at', '<=', $now))->count(),
            // Shipped a week ago and still not delivered: worth a call to the shipping company.
            'stale_shipments' => Order::query()->where('status', OrderStatus::Shipped)->where('status_changed_at', '<', $now->copy()->subDays(7))->count(),
            'abandoned' => $entitlements->allows(PlanFeature::AbandonedLeads) ? AbandonedLead::query()->where('status', LeadStatus::Open)->whereNotNull('customer_phone')->count() : null,
            'out_of_stock' => (int) ($stock['out'] ?? 0),
            'low_stock' => (int) ($stock['low'] ?? 0),
            'ending_promotions' => $ending(Offer::query()) + $ending(DiscountCode::query()) + $ending(ShippingOffer::query()),
        ];
    }

    /**
     * Steps of a new store. A custom domain is optional: the store is ready without it.
     *
     * @return array{steps: list<array{key: string, done: bool, optional: bool}>, done: bool}
     */
    private function setupSteps(Entitlements $entitlements, StoreSetup $setup): array
    {
        $tenant = Tenant::query()->findOrFail((int) Tenancy::id());
        $store = Store::query()->with('homePage')->first();
        $hasStore = $entitlements->allows(PlanFeature::Store);

        $steps = [
            ['key' => 'product', 'done' => Product::query()->exists(), 'optional' => false],
            ['key' => 'shipping', 'done' => (bool) ShippingSetting::query()->value('enabled') && ShippingCompany::query()->where('is_active', true)->exists(), 'optional' => false],
        ];
        if ($hasStore) {
            $steps[] = ['key' => 'store', 'done' => $store !== null && $setup->isLive($tenant, $store) && $store->homePage?->isPublished() === true, 'optional' => false];
        }
        $steps[] = ['key' => 'domain', 'done' => Domain::query()->where('type', DomainType::Custom)->exists(), 'optional' => true];

        return ['steps' => $steps, 'done' => collect($steps)->every(fn (array $s) => $s['done'] || $s['optional'])];
    }
}
