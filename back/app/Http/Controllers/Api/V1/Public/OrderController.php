<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Actions\Orders\CreateOrder;
use App\Actions\Orders\PostOrderUpsell;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\PublicOrderRequest;
use App\Http\Requests\Public\PublicQuoteRequest;
use App\Models\Order;
use App\Pricing\PriceCalculator;
use App\Services\FormToken;
use App\Services\PhoneNormalizer;
use App\Services\PublicSite;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** Visitor order endpoints, proxied by Next's /api/public/* route handlers. */
final class OrderController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site) {}

    /** Fetched by the browser on form load (never part of the cached HTML). */
    public function formToken(Request $request, FormToken $tokens): JsonResponse
    {
        $domain = $this->site->activeDomainOrFail((string) $request->query('host', ''));
        $pageId = Tenancy::runAs($domain->tenant_id, fn () => $this->site->pageOrFail((string) $request->query('slug', ''))->id);

        return $this->ok(['token' => $tokens->issue($pageId)])->header('Cache-Control', 'no-store, private');
    }

    public function quote(PublicQuoteRequest $request, PriceCalculator $calculator, PhoneNormalizer $phones): JsonResponse
    {
        $data = $request->validated();
        $domain = $this->site->activeDomainOrFail($data['host']);

        $quote = Tenancy::runAs($domain->tenant_id, function () use ($data, $calculator, $phones) {
            $page = $this->site->pageOrFail((string) ($data['slug'] ?? ''));
            $product = $page->product;
            if ($product === null || $product->trashed() || ! $product->is_active) {
                throw new ApiException(422, 'product_unavailable', __('orders.product_unavailable'));
            }

            // The product always comes from the page, never from the visitor.
            return $calculator->quote($product, (int) $data['quantity'], (array) ($data['options'] ?? []), now(), $data['code'] ?? null, $phones->normalize($data['phone'] ?? null), governorate: $data['governorate'] ?? null);
        });

        return $this->ok($quote->toArray());
    }

    public function store(PublicOrderRequest $request, CreateOrder $action): JsonResponse
    {
        $data = $request->validated();
        $domain = $this->site->activeDomainOrFail($data['host']);

        return Tenancy::runAs($domain->tenant_id, function () use ($data, $action, $domain) {
            $page = $this->site->pageOrFail((string) ($data['slug'] ?? ''));
            $key = isset($data['idempotency_key']) ? "order-idem:{$domain->tenant_id}:{$data['idempotency_key']}" : null;

            if ($key === null) {
                return $this->created($action->handle($page, $data));
            }

            // Same attempt sent twice (network retry): one order, same answer.
            return Cache::lock($key.':lock', 15)->block(10, function () use ($key, $page, $data, $action) {
                $result = Cache::get($key);
                if ($result === null) {
                    $result = $action->handle($page, $data);
                    Cache::put($key, $result, now()->addMinutes(30));
                }

                return $this->created($result);
            });
        });
    }

    /** One click on the success screen: add the post-order offer to the visitor's new order. */
    public function acceptUpsell(Request $request, PostOrderUpsell $upsells): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            'order_number' => ['required', 'integer', 'min:1'],
            'upsell_id' => ['required', 'integer', 'min:1'],
            'token' => ['required', 'string', 'size:64'],
            'ip' => ['nullable', 'ip'],
        ]);
        $domain = $this->site->activeDomainOrFail($data['host']);

        return Tenancy::runAs($domain->tenant_id, function () use ($data, $upsells) {
            $order = Order::query()->where('order_number', (int) $data['order_number'])->first()
                ?? throw new ApiException(422, 'upsell_closed', __('orders.upsell_closed'));

            return $this->ok($upsells->accept($order, (int) $data['upsell_id'], $data['token']));
        });
    }
}
