<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Enums\OrderStatus;
use App\Exceptions\ApiException;
use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ShipOrderRequest;
use App\Http\Resources\CarrierAccountResource;
use App\Http\Resources\ShipmentResource;
use App\Models\CarrierAccount;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\ShippingCompany;
use App\Rules\TenantExists;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\Carriers;
use App\Shipping\ManageShipments;
use App\Shipping\ShipOrder;
use App\Support\Money;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

/** Shipping orders through connected carriers: the ship dialog, one or many orders, cancel, refresh, airway bills. */
final class ShipmentController extends Controller
{
    use RespondsWithJson;

    /** Orders per bulk request (the screen sends a long selection in steps, showing progress). */
    public const BULK = 10;

    public function __construct(
        private readonly Carriers $carriers,
        private readonly ShipOrder $ship,
        private readonly ManageShipments $shipments,
    ) {}

    /** What the ship dialog needs: the connected carriers, the matched area (or the list), the cash to collect. */
    public function prepare(Request $request, Order $order): JsonResponse
    {
        $order->load(['items:id,order_id,quantity', 'shipment.events']);
        $accounts = CarrierAccount::query()->with('company')->get();
        // The dialog may ask for another connected carrier's areas (?carrier=).
        $default = $accounts->firstWhere('carrier', (string) $request->query('carrier', '')) ?? $this->defaultAccount($order, $accounts->all());
        $area = ['matched' => null, 'districts' => [], 'error' => null];
        if ($default !== null && trim((string) $order->governorate) !== '') {
            try {
                $carrier = $this->carriers->get($default->carrier);
                $area['matched'] = $carrier->matchDistrict((string) $order->governorate, $order->city);
                $area['districts'] = $carrier->districts((string) $order->governorate);
            } catch (CarrierError $e) {
                $area['error'] = $e->getMessage();
            }
        }

        return $this->ok([
            'carriers' => $accounts->map(fn (CarrierAccount $a) => [
                'carrier' => $a->carrier,
                'name' => $this->carriers->get($a->carrier)->label(),
                'account' => CarrierAccountResource::make($a)->resolve($request),
            ])->values()->all(),
            'default_carrier' => $default?->carrier,
            'area' => $area,
            'cod' => Money::toFloat(Money::toCents((string) $order->total)),
            'items_count' => $order->items->isNotEmpty() ? (int) $order->items->sum('quantity') : (int) ($order->quantity ?: 1),
            'can_ship' => $order->status === OrderStatus::Confirmed && ! ($order->shipment?->is_open ?? false),
            'shipment' => $order->shipment === null ? null : ShipmentResource::make($order->shipment)->resolve($request),
        ]);
    }

    public function store(ShipOrderRequest $request, Order $order): JsonResponse
    {
        $account = $this->accountByKey((string) $request->validated('carrier'));
        $shipment = $this->ship->handle($order, $account, $request->shipInput(), $request->user()?->id);

        return $this->created(ShipmentResource::make($shipment->load('events'))->resolve($request));
    }

    /** Several confirmed orders, each with its own result (the reason when one can't go). */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:'.self::BULK],
            'order_ids.*' => ['integer', 'distinct', TenantExists::table('orders')],
            'carrier' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);
        $accounts = CarrierAccount::query()->get();
        $chosen = isset($data['carrier']) ? $this->accountByKey((string) $data['carrier']) : null;
        $results = [];
        foreach (Order::query()->whereKey($data['order_ids'])->orderBy('id')->get() as $order) {
            $account = $chosen ?? $this->defaultAccount($order, $accounts->all());
            try {
                if ($account === null) {
                    throw new ApiException(422, 'ship_choose_carrier', (string) __('shipping.ship.choose_carrier'));
                }
                $shipment = $this->ship->handle($order, $account, [], $request->user()?->id);
                $results[] = ['order_id' => $order->id, 'order_number' => $order->order_number, 'ok' => true, 'shipment_id' => $shipment->id, 'tracking_number' => $shipment->tracking_number];
            } catch (ApiException $e) {
                $results[] = ['order_id' => $order->id, 'order_number' => $order->order_number, 'ok' => false, 'code' => $e->errorCode, 'error' => $e->getMessage()];
            }
        }

        return $this->ok($results);
    }

    public function cancel(Request $request, Shipment $shipment): JsonResponse
    {
        return $this->ok(ShipmentResource::make($this->shipments->cancel($shipment)->load('events'))->resolve($request));
    }

    public function refresh(Request $request, Shipment $shipment): JsonResponse
    {
        return $this->ok(ShipmentResource::make($this->shipments->refresh($shipment)->load('events'))->resolve($request));
    }

    /** The airway bills of shipments (or of orders' open shipments) as one PDF, to open and print. */
    public function labels(Request $request): SymfonyResponse
    {
        $data = $request->validate([
            'ids' => ['required_without:order_ids', 'array', 'max:'.ManageShipments::MAX_LABELS],
            'ids.*' => ['integer', TenantExists::table('shipments')],
            'order_ids' => ['required_without:ids', 'array', 'max:'.ManageShipments::MAX_LABELS],
            'order_ids.*' => ['integer', TenantExists::table('orders')],
            'size' => ['sometimes', 'nullable', 'string', 'in:A4,A6'],
        ]);
        $shipments = isset($data['ids'])
            ? Shipment::query()->whereKey($data['ids'])->orderBy('id')->get()
            : Shipment::query()->whereIn('order_id', $data['order_ids'])->where('is_open', true)->orderBy('id')->get();
        $pdf = $this->shipments->labels($shipments, $data['size'] ?? null);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="airway-bills.pdf"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    private function accountByKey(string $carrier): CarrierAccount
    {
        $this->carriers->get($carrier);

        return CarrierAccount::query()->where('carrier', $carrier)->first()
            ?? throw new ApiException(422, 'carrier_not_connected', (string) __('shipping.carriers.not_connected'));
    }

    /**
     * The account the order goes through by default: its shipping company's, else the only connected one.
     *
     * @param  list<CarrierAccount>  $accounts
     */
    private function defaultAccount(Order $order, array $accounts): ?CarrierAccount
    {
        if ($order->shipping_company_id !== null) {
            $linked = ShippingCompany::query()->whereKey($order->shipping_company_id)->value('carrier_account_id');
            foreach ($accounts as $account) {
                if ($account->id === $linked) {
                    return $account;
                }
            }
        }

        return count($accounts) === 1 ? $accounts[0] : null;
    }
}
