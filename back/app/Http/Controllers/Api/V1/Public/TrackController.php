<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Public;

use App\Enums\OrderStatus;
use App\Enums\ShipmentState;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Models\Identity;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ShipmentEvent;
use App\Services\PhoneNormalizer;
use App\Services\PublicPageData;
use App\Services\PublicSite;
use App\Store\Accounts\CustomerOrders;
use App\Store\Payments\StorePayments;
use App\Support\Money;
use App\Tenancy\Tenancy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Customer order tracking on the store's site (/track): order number + phone must match.
 * Only what the customer needs: stage, items, total and dates (no internal notes or states).
 */
final class TrackController extends Controller
{
    use RespondsWithJson;

    public function __construct(private readonly PublicSite $site, private readonly PublicPageData $data) {}

    /** Store look for the tracking page: the default identity and the home page slug. */
    public function brand(Request $request): JsonResponse
    {
        $domain = $this->site->activeDomainOrFail((string) $request->query('host', ''));

        return Tenancy::runAs($domain->tenant_id, function () {
            $identity = Identity::query()->where('is_default', true)->first() ?? Identity::query()->first();

            return $this->ok([
                'identity' => $identity === null ? null : $this->data->identity($identity),
                'home_slug' => $this->site->homeSlug(),
            ]);
        });
    }

    /**
     * The short link in order messages (https://{platform}/t/{token}): where the order's store
     * tracks it. Only the store's address comes back, never order data.
     */
    public function link(Request $request): JsonResponse
    {
        $data = $request->validate(['token' => ['required', 'string', 'regex:/^[a-z0-9]{12}$/']]);

        // Audited bypass: the token is unique platform-wide and unguessable; only the tenant id is read.
        $tenantId = Tenancy::withoutTenant(fn () => Order::query()->where('track_token', $data['token'])->value('tenant_id'));
        $host = $tenantId === null ? null : $this->site->primaryHost((int) $tenantId);
        if ($host === null) {
            throw new ApiException(404, 'order_not_found', __('orders.track_not_found'));
        }

        return $this->ok(['url' => rtrim(PublicSite::url($host), '/').'/track?t='.$data['token']])->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, PhoneNormalizer $phones): JsonResponse
    {
        $data = $request->validate([
            'host' => ['required', 'string', 'max:253'],
            // The private link from the order messages, or order number + phone.
            'token' => ['nullable', 'string', 'regex:/^[a-z0-9]{12}$/'],
            'order_number' => ['required_without:token', 'nullable', 'integer', 'min:1', 'max:999999999'],
            'phone' => ['required_without:token', 'nullable', 'string', 'max:30'],
            'ip' => ['nullable', 'ip'],
        ]);
        $domain = $this->site->activeDomainOrFail($data['host']);

        if (isset($data['token'])) {
            $order = Tenancy::runAs($domain->tenant_id, fn () => Order::query()->with(['items', 'logs', 'shipment.events'])->where('track_token', $data['token'])->first());
        } else {
            $phone = $phones->normalize((string) $data['phone']);
            $order = $phone === null ? null : Tenancy::runAs($domain->tenant_id, fn () => Order::query()
                ->with(['items', 'logs', 'shipment.events'])
                ->where('order_number', (int) $data['order_number'])
                ->where(fn ($q) => $q->where('customer_phone', $phone)->orWhere('customer_phone2', $phone))
                ->first());
        }

        // Same answer for a wrong number and a wrong phone.
        if ($order === null) {
            throw new ApiException(404, 'order_not_found', __('orders.track_not_found'));
        }

        return $this->ok([
            'order_number' => $order->order_number,
            'stage' => $order->status->customerStage(),
            'created_at' => $order->created_at->toIso8601ZuluString(),
            'items' => $order->items->map(fn (OrderItem $item) => [
                'name' => $item->product_name,
                'quantity' => $item->quantity,
                'options' => array_values(array_map(fn ($o) => (string) ($o['value'] ?? ''), $item->options ?? [])),
            ])->values()->all(),
            'total' => Money::toFloat(Money::toCents((string) $order->total)),
            'governorate' => $order->governorate,
            'shipping_company' => $order->shipping_company_name,
            'tracking_number' => $order->tracking_number,
            'history' => CustomerOrders::history($order),
            // A prepaid order waiting for its payment: the pay page.
            'pay_url' => $order->status === OrderStatus::AwaitingPayment ? StorePayments::payUrl($order) : null,
            // Digital products: the order page with the downloads / codes.
            'products_url' => $order->isPrepaid() && $order->items->contains(fn (OrderItem $i) => $i->delivery_type !== null) ? StorePayments::payUrl($order) : null,
            // The carrier's timeline, when the store ships through a connected carrier (our words, never its internals).
            'shipment' => $order->shipment === null || $order->shipment->state === ShipmentState::Cancelled ? null : [
                'tracking_number' => $order->shipment->tracking_number,
                'state' => $order->shipment->state->value,
                'state_label' => $order->shipment->state->label(),
                'events' => $order->shipment->events->map(fn (ShipmentEvent $e) => ['state' => $e->state->value, 'label' => $e->state->label(), 'at' => $e->happened_at->toIso8601ZuluString()])->values()->all(),
            ],
        ])->header('Cache-Control', 'no-store, private');
    }
}
