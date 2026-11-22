<?php

declare(strict_types=1);

namespace App\Shipping;

use App\Enums\ShipmentState;
use App\Exceptions\ApiException;
use App\Models\CarrierAccount;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\User;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\Carriers;
use App\Shipping\Carriers\CarrierUpdate;
use App\Shipping\Carriers\PickupRequest;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/** What the merchant does with shipments after creating them: cancel, refresh, print airway bills, call a courier. */
final class ManageShipments
{
    /** Airway bills in one file (the carrier emails bigger batches). */
    public const MAX_LABELS = 50;

    public function __construct(
        private readonly Carriers $carriers,
        private readonly ApplyShipmentUpdate $updates,
    ) {}

    /** Calls the shipment off at the carrier (only before the courier picks it up); the order stays confirmed. */
    public function cancel(Shipment $shipment): Shipment
    {
        if (! $shipment->is_open) {
            throw new ApiException(422, 'ship_closed', (string) __('shipping.ship.closed', ['state' => $shipment->state->label()]));
        }
        if ($shipment->state !== ShipmentState::Created) {
            throw new ApiException(422, 'ship_cancel_late', (string) __('shipping.ship.cancel_late'));
        }
        $account = $this->account($shipment);
        $this->guard(fn () => $this->carriers->get($shipment->carrier)->cancel($account, $shipment->tracking_number), $account);
        $shipment = $this->updates->handle($shipment, new CarrierUpdate($shipment->tracking_number, ShipmentState::Cancelled, null, null, CarbonImmutable::now()));
        Order::query()->whereKey($shipment->order_id)->where('tracking_number', $shipment->tracking_number)->update(['tracking_number' => null]);

        return $shipment;
    }

    /** Asks the carrier where the shipment is now (the «حدّث» button and the scheduled sync). */
    public function refresh(Shipment $shipment): Shipment
    {
        if (! $shipment->is_open) {
            return $shipment;
        }
        $account = $this->account($shipment);
        $update = $this->guard(fn () => $this->carriers->get($shipment->carrier)->track($account, $shipment->tracking_number), $account);

        return $this->updates->handle($shipment, $update);
    }

    /**
     * The airway bills of these shipments as one PDF (one carrier at a time).
     *
     * @param  Collection<int, Shipment>  $shipments
     */
    public function labels(Collection $shipments, ?string $size): string
    {
        $printable = $shipments->filter(fn (Shipment $s) => $s->is_open && $s->carrier_account_id !== null)->values();
        if ($printable->isEmpty()) {
            throw new ApiException(422, 'labels_none', (string) __('shipping.ship.labels_none'));
        }
        if ($printable->pluck('carrier_account_id')->unique()->count() > 1) {
            throw new ApiException(422, 'labels_one_carrier', (string) __('shipping.ship.labels_one_carrier'));
        }
        $account = $this->account($printable->first());

        return $this->guard(fn () => $this->carriers->get($account->carrier)->labels($account, $printable->pluck('tracking_number')->all(), $size ?? (string) $account->setting('label_size', 'A4')), $account);
    }

    public function pickup(CarrierAccount $account, string $date, int $parcels, ?string $notes, User $user): void
    {
        $this->guard(fn () => $this->carriers->get($account->carrier)->pickup($account, new PickupRequest(
            date: $date,
            locationId: $account->setting('location_id'),
            parcels: $parcels,
            contactName: (string) $user->name,
            contactPhone: $user->phone ?: null,
            notes: $notes,
        )), $account);
    }

    private function account(Shipment $shipment): CarrierAccount
    {
        $account = $shipment->carrier_account_id === null ? null : CarrierAccount::query()->find($shipment->carrier_account_id);
        if ($account === null) {
            throw new ApiException(422, 'carrier_not_connected', (string) __('shipping.carriers.not_connected'));
        }

        return $account;
    }

    /**
     * @template T
     *
     * @param  callable(): T  $call
     * @return T
     */
    private function guard(callable $call, CarrierAccount $account): mixed
    {
        try {
            return $call();
        } catch (CarrierError $e) {
            if ($e->auth) {
                $account->forceFill(['status' => CarrierAccount::FAILED, 'last_error' => mb_substr($e->getMessage(), 0, 300), 'checked_at' => now()])->save();
            }
            throw new ApiException(422, $e->auth ? 'carrier_auth' : 'carrier_refused', $e->getMessage());
        }
    }
}
