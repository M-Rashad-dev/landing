<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Analytics\SalesFigures;
use App\Billing\Entitlements;
use App\Enums\DomainType;
use App\Enums\LeadStatus;
use App\Enums\OrderStatus;
use App\Enums\PlanFeature;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\AbandonedLead;
use App\Models\DiscountCode;
use App\Models\Domain;
use App\Models\Offer;
use App\Models\Order;
use App\Models\Product;
use App\Models\ShippingCompany;
use App\Models\ShippingOffer;
use App\Models\ShippingSetting;
use App\Models\Store;
use App\Models\Tenant;
use App\Store\ProductList;
use App\Store\StoreSetup;
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

    public function __construct(private readonly SalesFigures $sales) {}

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
            'kpis' => $this->sales->kpis($from, $to),
            'previous' => $this->sales->kpis($prevFrom, $prevTo),
            'chart' => $this->sales->chart($from, $to, $tz),
            'statuses' => $this->sales->statuses($from, $to),
            'top_products' => $this->sales->topProducts($from, $to),
            'top_governorates' => $this->sales->topGovernorates($from, $to),
            'sources' => $this->sales->sources($from, $to),
            'latest_orders' => OrderResource::collection(Order::query()->with('items:id,order_id,product_name,quantity,is_gift')->orderByDesc('order_number')->limit(6)->get())->resolve($request),
            'todo' => $this->todo($entitlements, $products),
            'setup' => $this->setupSteps($entitlements, $setup),
        ]);
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
        $store = Store::query()->first();
        $hasStore = $entitlements->allows(PlanFeature::Store);

        $steps = [
            ['key' => 'product', 'done' => Product::query()->exists(), 'optional' => false],
            ['key' => 'shipping', 'done' => (bool) ShippingSetting::query()->value('enabled') && ShippingCompany::query()->where('is_active', true)->exists(), 'optional' => false],
        ];
        if ($hasStore) {
            $steps[] = ['key' => 'store', 'done' => $setup->isLive($tenant, $store), 'optional' => false];
        }
        // An optional step the merchant chose to skip counts as done (tenant settings, SetupSkipController).
        $skipped = (array) ($tenant->settings['setup_skipped'] ?? []);
        $steps[] = ['key' => 'domain', 'done' => in_array('domain', $skipped, true) || Domain::query()->where('type', DomainType::Custom)->exists(), 'optional' => true];

        return ['steps' => $steps, 'done' => collect($steps)->every(fn (array $s) => $s['done'] || $s['optional'])];
    }
}
