<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use App\Models\CarrierAccount;

/**
 * A shipping carrier the store can ship through (docs/plans/shipping-carriers.md). One class per carrier (Bosta
 * today); the rest of the platform only talks to this. Every failure is a CarrierError with words for the merchant.
 */
interface Carrier
{
    /** Stable key (stored on accounts and shipments). */
    public function key(): string;

    /** The carrier's name as the merchant knows it. */
    public function label(): string;

    /**
     * Checks the merchant's credentials (a wrong key → CarrierError with auth = true).
     *
     * @param  array<string, string>  $credentials
     */
    public function verify(array $credentials): CarrierProfile;

    /**
     * The carrier's delivery areas inside one of our governorates, for the merchant to pick from.
     *
     * @return list<array{id: string, name: string}>
     */
    public function districts(string $governorate): array;

    /** The area matching the customer's city text, when it is clear (null → the merchant picks it). */
    public function matchDistrict(string $governorate, ?string $city): ?string;

    public function create(CarrierAccount $account, ShipmentDraft $draft): CarrierShipment;

    public function track(CarrierAccount $account, string $trackingNumber): CarrierUpdate;

    /** Calls a shipment off (only while the carrier allows it). */
    public function cancel(CarrierAccount $account, string $trackingNumber): void;

    /**
     * The carrier's airway bills as one PDF.
     *
     * @param  list<string>  $trackingNumbers
     */
    public function labels(CarrierAccount $account, array $trackingNumbers, string $size): string;

    /** Asks the carrier to send a courier on a day. */
    public function pickup(CarrierAccount $account, PickupRequest $request): void;

    /**
     * A status update the carrier posted to our webhook (null: not about a shipment).
     *
     * @param  array<string, mixed>  $payload
     */
    public function webhook(array $payload): ?CarrierUpdate;
}
