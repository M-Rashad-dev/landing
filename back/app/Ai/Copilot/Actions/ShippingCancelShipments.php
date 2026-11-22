<?php

declare(strict_types=1);

namespace App\Ai\Copilot\Actions;

use App\Ai\Copilot\Changes\ActionPreview;
use App\Ai\Copilot\Changes\Selector;
use App\Ai\Copilot\Contracts\CopilotAction;
use App\Ai\Copilot\CopilotCatalog;
use App\Ai\Copilot\CopilotContext;
use App\Ai\Copilot\Support\CopilotToolError;
use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use App\Models\CopilotChangeItem;
use App\Models\CopilotChangeSet;
use App\Models\Order;
use App\Models\Shipment;
use App\Shipping\ManageShipments;

/** Cancels orders' shipments at the carrier while the courier hasn't picked them up (the orders stay confirmed). */
final class ShippingCancelShipments extends CopilotAction
{
    public const MAX = 100;

    public function __construct(private readonly CopilotCatalog $catalog, private readonly ManageShipments $shipments) {}

    public function key(): string
    {
        return 'shipping.cancel_shipments';
    }

    public function label(): string
    {
        return 'إلغاء شحنات';
    }

    public function summary(): string
    {
        return 'Cancel the open shipments of orders at the carrier (≤ '.self::MAX.'), only those the courier has not picked up yet. The orders stay confirmed.';
    }

    public function available(CopilotContext $ctx): bool
    {
        return CarrierAccount::query()->exists();
    }

    public function schema(): array
    {
        return ['type' => 'object', 'properties' => [
            'selector' => ['type' => 'object', 'description' => 'Like update_records on orders.'],
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
        return ['tracking_number' => ['رقم التتبع', 'text']];
    }

    public function preview(array $args, CopilotContext $ctx): ActionPreview
    {
        $resource = $this->catalog->resource('orders', $ctx) ?? throw new CopilotToolError('Orders are not available.');
        $ids = Selector::ids($resource, is_array($args['selector'] ?? null) ? $args['selector'] : [], $ctx);
        if (count($ids) > self::MAX) {
            throw new CopilotToolError('That is '.count($ids).' orders; one run holds at most '.self::MAX.'.');
        }
        $numbers = Order::query()->whereKey($ids)->pluck('order_number', 'id');
        $items = [];
        foreach (Shipment::query()->whereIn('order_id', $ids)->where('is_open', true)->orderBy('id')->get() as $shipment) {
            $ok = $shipment->state === ShipmentState::Created && $shipment->carrier_account_id !== null;
            $items[] = [
                'entity_type' => 'shipments',
                'entity_id' => $shipment->id,
                'label' => 'طلب #'.($numbers[$shipment->order_id] ?? ''),
                'before' => [],
                'after' => ['tracking_number' => $shipment->tracking_number],
                'status' => $ok ? CopilotChangeItem::PENDING : CopilotChangeItem::SKIPPED_INVALID,
                'note' => $ok ? null : (string) __('shipping.ship.cancel_late'),
            ];
        }
        if ($items === []) {
            throw new CopilotToolError('None of these orders has an open shipment.');
        }

        return new ActionPreview(
            summary: (string) __('ai.copilot.ship_cancel_summary', ['count' => count(array_filter($items, fn (array $i) => $i['status'] === CopilotChangeItem::PENDING))]),
            items: $items,
            sideEffects: [],
            spec: [],
        );
    }

    public function apply(CopilotChangeItem $item, CopilotChangeSet $set, CopilotContext $ctx): void
    {
        $this->shipments->cancel(Shipment::query()->findOrFail($item->entity_id));
    }
}
