<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Changes\Selector;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Enums\OrderStatus;
use App\Models\CarrierAccount;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\ShippingCompany;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\Carriers;
use App\Shipping\ShipOrder;

/**
 * Ships confirmed orders through a connected carrier (Bosta…), each through the order page's own ShipOrder: the
 * customer's area matched from the city, the order total collected, the account's settings. The preview says which
 * orders can't go and why (not confirmed, already shipped, area to pick on the order page). No undo here: a shipment
 * is cancelled from the order page while the courier hasn't picked it up.
 */
final class ShippingShipOrders extends CopilotAction
{
    public const MAX = 100;

    public function __construct(private readonly CopilotCatalog $catalog, private readonly Carriers $carriers, private readonly ShipOrder $ship) {}

    public function key(): string
    {
        return 'shipping.ship_orders';
    }

    public function label(): string
    {
        return 'شحن الطلبات مع شركة الشحن';
    }

    public function summary(): string
    {
        return 'Ship confirmed orders through a connected carrier (≤ '.self::MAX.'): creates the shipments and their airway bills there, collecting each order total. carrier: a connected carrier key (default: each order\'s own company\'s carrier, or the only connected one).';
    }

    public function available(CopilotContext $ctx): bool
    {
        return CarrierAccount::query()->exists();
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'selector' => ['type' => 'object', 'description' => 'Like update_records on orders, e.g. {"filters": {"status": ["confirmed"]}} or {"context": "selection"}.'],
            'carrier' => ['type' => 'string', 'enum' => $this->carriers->keys()],
        ], 'required' => ['selector']];
    }

    public function approval(): bool
    {
        return true;
    }

    public function reversible(): bool
    {
        return false;
    }

    public function columns(): array
    {
        return ['carrier' => ['الشركة', 'text'], 'cod' => ['التحصيل', 'money']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $resource = $this->catalog->resource('orders', $ctx) ?? throw new CopilotToolError('Orders are not available.');
        $ids = Selector::ids($resource, is_array($args['selector'] ?? null) ? $args['selector'] : [], $ctx);
        if (count($ids) > self::MAX) {
            throw new CopilotToolError('That is '.count($ids).' orders; one run ships at most '.self::MAX.'. Narrow the filters.');
        }
        $accounts = CarrierAccount::query()->get();
        $chosen = isset($args['carrier']) ? $accounts->firstWhere('carrier', (string) $args['carrier']) : null;
        if (isset($args['carrier']) && $chosen === null) {
            throw new CopilotToolError('That carrier is not connected. Connected: '.($accounts->pluck('carrier')->implode(', ') ?: 'none').'.');
        }
        $open = Shipment::query()->whereIn('order_id', $ids)->where('is_open', true)->pluck('tracking_number', 'order_id');
        $linked = ShippingCompany::query()->whereNotNull('carrier_account_id')->pluck('carrier_account_id', 'id');

        $items = [];
        foreach (Order::query()->whereKey($ids)->orderBy('order_number')->get() as $order) {
            $account = $chosen ?? $accounts->firstWhere('id', $linked[$order->shipping_company_id] ?? null) ?? ($accounts->count() === 1 ? $accounts->first() : null);
            $why = match (true) {
                $order->status !== OrderStatus::Confirmed => (string) __('shipping.ship.not_confirmed'),
                $open->has($order->id) => (string) __('shipping.ship.exists', ['tracking' => $open[$order->id]]),
                $account === null => (string) __('shipping.ship.choose_carrier'),
                default => $this->areaProblem($order, $account),
            };
            $items[] = [
                'entity_type' => 'orders',
                'entity_id' => $order->id,
                'label' => 'طلب #'.$order->order_number,
                'before' => [],
                'after' => ['carrier' => $account === null ? '—' : $this->carriers->get($account->carrier)->label(), 'cod' => (string) $order->total, 'account_id' => $account?->id],
                'status' => $why === null ? CopilotChangeItem::PENDING : CopilotChangeItem::SKIPPED_INVALID,
                'note' => $why,
            ];
        }
        $count = count(array_filter($items, fn (array $i) => $i['status'] === CopilotChangeItem::PENDING));

        return new ActionPreview(
            summary: (string) __('ai.copilot.ship_summary', ['count' => $count]),
            items: $items,
            sideEffects: $count > 0 ? [['key' => 'shipments', 'count' => $count, 'text' => (string) __('ai.copilot.ship_effect', ['count' => $count])]] : [],
            spec: [],
        );
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $order = Order::query()->findOrFail($item->entity_id);
        $account = CarrierAccount::query()->findOrFail((int) ($item->after['account_id'] ?? 0));
        $this->ship->handle($order, $account, [], $ctx->user?->id);
    }

    /** Why the carrier can't take the order's address as it is (null: it can). */
    private function areaProblem(Order $order, CarrierAccount $account): ?string
    {
        if (trim((string) $order->governorate) === '') {
            return (string) __('shipping.ship.no_governorate');
        }
        if (mb_strlen(trim((string) $order->address)) < 6) {
            return (string) __('shipping.ship.address_short');
        }
        try {
            $carrier = $this->carriers->get($account->carrier);

            return $carrier->matchDistrict((string) $order->governorate, $order->city) === null
                ? (string) __('ai.copilot.ship_pick_area', ['carrier' => $carrier->label()])
                : null;
        } catch (CarrierError $e) {
            return $e->getMessage();
        }
    }
}
