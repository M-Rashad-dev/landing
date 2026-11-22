<?php

declare(strict_types=1);

namespace App\Shipping;

use App\Actions\Orders\ChangeOrderStatus;
use App\Enums\OrderStatus;
use App\Enums\ShipmentState;
use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\Shipment;
use App\Notifications\StoreNotices;
use App\Shipping\Carriers\Carriers;
use App\Shipping\Carriers\CarrierUpdate;
use Illuminate\Support\Facades\DB;

/**
 * What a carrier says about a shipment (webhook, sync, cancel): the shipment's state and timeline, then the order
 * follows through ChangeOrderStatus (customer messages, webhooks, stock as when the merchant does it), and the
 * merchant is told about problems. Old or repeated news changes nothing.
 */
final class ApplyShipmentUpdate
{
    public function __construct(
        private readonly ChangeOrderStatus $status,
        private readonly StoreNotices $notices,
        private readonly Carriers $carriers,
    ) {}

    public function handle(Shipment $shipment, CarrierUpdate $update): Shipment
    {
        $changed = DB::transaction(function () use ($shipment, $update): bool {
            /** @var Shipment $locked */
            $locked = Shipment::query()->whereKey($shipment->id)->lockForUpdate()->firstOrFail();
            $last = $locked->events()->max('happened_at');
            $stale = $last !== null && $update->at->lt($last);
            if ($update->state === null || $stale) {
                $locked->forceFill(['synced_at' => now()])->save();

                return false;
            }
            $same = $update->state === $locked->state && ($update->code === null || $update->code === $locked->carrier_code);
            $locked->forceFill([
                'state' => $update->state,
                'carrier_code' => $update->code ?? $locked->carrier_code,
                'carrier_label' => $update->label === null ? $locked->carrier_label : mb_substr($update->label, 0, 80),
                'exception' => $update->state === ShipmentState::Exception ? ($update->note === null ? $locked->exception : mb_substr($update->note, 0, 200)) : null,
                'attempts' => $update->attempts ?? $locked->attempts,
                'is_open' => $update->state->isOpen(),
                'synced_at' => now(),
            ])->save();
            if (! $same) {
                $locked->events()->create(['state' => $update->state, 'carrier_code' => $update->code, 'label' => $update->label === null ? null : mb_substr($update->label, 0, 120), 'note' => $update->note === null ? null : mb_substr($update->note, 0, 200), 'happened_at' => $update->at]);
            }

            return ! $same;
        });

        $shipment->refresh();
        if ($changed) {
            $this->moveOrder($shipment);
            if ($shipment->state->isProblem()) {
                $this->notices->shipmentProblem($shipment, $this->carriers->get($shipment->carrier)->label());
            }
        }

        return $shipment;
    }

    /** The order goes where the shipment says (through «تم الشحن» when it must), unless the merchant moved it on. */
    private function moveOrder(Shipment $shipment): void
    {
        $target = $shipment->state->orderStatus();
        $order = Order::query()->find($shipment->order_id);
        if ($target === null || $order === null || $order->status === $target) {
            return;
        }
        $steps = $order->status->canTransitionTo($target) ? [$target]
            : ($order->status === OrderStatus::Confirmed && OrderStatus::Shipped->canTransitionTo($target) ? [OrderStatus::Shipped, $target] : []);
        $note = (string) __('shipping.ship.order_note', ['carrier' => $this->carriers->get($shipment->carrier)->label(), 'state' => $shipment->state->label()]);
        foreach ($steps as $step) {
            try {
                $order = $this->status->handle($order, $step, $note, null);
            } catch (ApiException) {
                // Someone moved the order meanwhile: leave it as it is.
                return;
            }
        }
    }
}
