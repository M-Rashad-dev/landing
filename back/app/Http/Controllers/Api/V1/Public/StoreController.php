<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Actions\Orders\CaptureLead;
use App\Billing\Entitlements;
use App\Enums\PlanFeature;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Store;
use App\Models\StorePage;
use App\Models\StoreStat;
use App\Models\Tenant;
use App\Pricing\PriceCalculator;
use App\Services\FormToken;
use App\Services\PhoneNormalizer;
use App\Services\PublicSite;
use App\Store\CreateStoreOrder;
use App\Store\StoreCatalog;
use App\Store\StoreSite;
use App\Support\TrafficSource;
use App\Tenancy\Tenancy;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Visitor-facing store endpoints Next calls server-side with the internal key. Every call
 * resolves host → tenant (sites open) → live store, then runs in that tenant context.
 */
final class StoreController extends Controller
{
    use RespondsWithJson;

    public function __construct(
        private readonly PublicSite $site,
        private readonly StoreSite $store,
        private readonly StoreCatalog $catalog,
    ) {}

    public function config(Request $request): JsonResponse
    {
        return $this->inStore($request, fn (Store $store, string $primary) => $this->ok($this->store->config($store, $primary)));
    }

    public function products(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category' => ['nullable', 'string', 'max:120'],
            'q' => ['nullable', 'string', 'max:60'],
            'sort' => ['nullable', Rule::in(StoreCatalog::SORTS)],
            'min' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'max' => ['nullable', 'numeric', 'min:0', 'max:9999999'],
            'in_stock' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        return $this->inStore($request, function (Store $store) use ($data) {
            $page = $this->catalog->search([...$data, 'in_stock' => filter_var($data['in_stock'] ?? false, FILTER_VALIDATE_BOOLEAN)], (int) $store->resolvedSettings()['products_per_page']);

            return $this->ok(
                $page->getCollection()->map(fn ($p) => $this->catalog->card($p))->values()->all(),
                ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
            );
        });
    }

    public function product(Request $request, string $slug): JsonResponse
    {
        return $this->inStore($request, fn () => $this->ok($this->store->product(mb_strtolower($slug)) ?? throw new ApiException(404, 'not_found', __('landing.not_found'))));
    }

    public function page(Request $request, string $slug): JsonResponse
    {
        return $this->inStore($request, function () use ($slug) {
            $page = StorePage::query()->where('is_published', true)->where('slug', mb_strtolower($slug))->first() ?? throw new ApiException(404, 'not_found', __('landing.not_found'));

            return $this->ok(['title' => $page->title, 'slug' => $page->slug, 'body' => $page->body, 'seo' => $page->seo]);
        });
    }

    public function formToken(Request $request, FormToken $tokens): JsonResponse
    {
        return $this->inStore($request, fn (Store $store) => $this->noStore($this->ok(['token' => $tokens->issue((int) $store->home_page_id)])));
    }

    public function quote(Request $request, PriceCalculator $calculator, CreateStoreOrder $orders): JsonResponse
    {
        $data = $request->validate($this->cartRules() + [
            'code' => ['nullable', 'string', 'max:30'],
            'phone' => ['nullable', 'string', 'max:30'],
            'governorate' => ['nullable', 'string', 'max:60'],
        ]);

        return $this->inStore($request, function () use ($data, $calculator, $orders) {
            $quote = $calculator->quoteCart($orders->lines($data['items']), now(), $data['code'] ?? null, $data['phone'] ?? null, false, $data['governorate'] ?? null);

            return $this->noStore($this->ok($quote->toArray()));
        });
    }

    public function order(Request $request, CreateStoreOrder $orders): JsonResponse
    {
        $data = $request->validate($this->cartRules() + [
            'customer' => ['required', 'array'],
            'code' => ['nullable', 'string', 'max:30'],
            'form_token' => ['nullable', 'string', 'max:100'],
            'website' => ['nullable', 'string', 'max:200'],
            'utm' => ['nullable', 'array'],
            'ip' => ['nullable', 'ip'],
            'user_agent' => ['nullable', 'string', 'max:2000'],
        ]);

        return $this->inStore($request, fn (Store $store) => $this->noStore($this->created($orders->handle($store, $data))));
    }

    /** Abandoned checkout: always 202 (bots learn nothing); stored only with the plan feature. */
    public function lead(Request $request, CaptureLead $leads, PhoneNormalizer $phones, FormToken $tokens, CreateStoreOrder $orders, PriceCalculator $calculator, Entitlements $entitlements): JsonResponse
    {
        $data = $request->validate($this->cartRules() + [
            'phone' => ['required', 'string', 'max:30'],
            'name' => ['nullable', 'string', 'max:80'],
            'governorate' => ['nullable', 'string', 'max:60'],
            'form_token' => ['required', 'string', 'max:100'],
            'ip' => ['nullable', 'ip'],
        ]);

        return $this->inStore($request, function (Store $store) use ($data, $leads, $phones, $tokens, $orders, $calculator, $entitlements) {
            $phone = $phones->normalize($data['phone']);
            if ($phone !== null && $tokens->isValid($data['form_token'], (int) $store->home_page_id) && $entitlements->allows(PlanFeature::AbandonedLeads)) {
                try {
                    $quote = $calculator->quoteCart($orders->lines($data['items']), now());
                    $leads->captureCart($phone, ['name' => isset($data['name']) ? trim(strip_tags($data['name'])) : null, 'governorate' => $data['governorate'] ?? null, 'ip' => $data['ip'] ?? null], [
                        'items' => array_map(fn ($l) => ['product_id' => $l->product->id, 'name' => $l->product->name, 'quantity' => $l->quantity], $quote->lines),
                        'total' => round($quote->total / 100, 2),
                    ]);
                } catch (ValidationException) {
                    // A cart that cannot be priced any more is not worth a follow-up.
                }
            }

            return $this->noStore(new JsonResponse(null, 202));
        });
    }

    /** Store traffic counters (first-party, no personal data). */
    public function event(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['view', 'product_view', 'add_to_cart', 'checkout'])],
            'utm_source' => ['nullable', 'string', 'max:100'],
            'referrer' => ['nullable', 'string', 'max:500'],
            'device' => ['nullable', Rule::in(['mobile', 'desktop'])],
        ]);

        return $this->inStore($request, function (Store $store) use ($data) {
            $column = ['view' => 'views', 'product_view' => 'product_views', 'add_to_cart' => 'add_to_cart', 'checkout' => 'checkouts'][$data['type']];
            // One atomic upsert per event (same pattern as page_stats).
            StoreStat::query()->upsert(
                [['tenant_id' => $store->tenant_id, 'date' => now('Africa/Cairo')->toDateString(), 'source' => TrafficSource::classify($data['utm_source'] ?? null, $data['referrer'] ?? null), 'device' => ($data['device'] ?? '') === 'desktop' ? 'desktop' : 'mobile', $column => 1]],
                ['tenant_id', 'date', 'source', 'device'],
                [$column => DB::raw("{$column} + 1")],
            );

            return new JsonResponse(null, 202);
        });
    }

    /** @return array<string, mixed> */
    private function cartRules(): array
    {
        return [
            'host' => ['required', 'string', 'max:253'],
            'items' => ['required', 'array', 'min:1', 'max:'.PriceCalculator::MAX_CART_LINES],
            'items.*.product_id' => ['required', 'integer', 'min:1'],
            'items.*.quantity' => ['required', 'integer', 'between:1,'.PriceCalculator::MAX_QUANTITY],
            'items.*.options' => ['nullable', 'array', 'max:10'],
            'items.*.options.*' => ['nullable', 'integer'],
        ];
    }

    /** @param Closure(Store, string): JsonResponse $callback */
    private function inStore(Request $request, Closure $callback): JsonResponse
    {
        $domain = $this->site->activeDomainOrFail((string) $request->input('host', $request->query('host', '')));
        $primary = $this->site->primaryHost($domain->tenant_id) ?? $domain->host;

        return Tenancy::runAs($domain->tenant_id, function () use ($domain, $callback, $primary) {
            $tenant = $domain->tenant ?? Tenant::query()->findOrFail($domain->tenant_id);
            $store = $this->store->live($tenant) ?? throw new ApiException(404, 'store_not_live', __('store.store_disabled'));

            return $callback($store, $primary)->header('Cache-Control', 'no-store, private');
        });
    }

    private function noStore(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'no-store, private');
    }
}
