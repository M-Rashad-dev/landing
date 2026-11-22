<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use App\Models\CarrierAccount;

/**
 * A shipping carrier the store can ship through (docs/plans/shipping-carriers.md). One class per carrier (Bosta, J&T);
 * the rest of the platform only talks to this. Every failure is a CarrierError with words for the merchant.
 */
interface Carrier
{
    /** What the screens adapt to (see features()). */
    public const LOCATIONS = 'locations';

    public const PICKUP = 'pickup';

    public const PACKAGE = 'package';

    public const SENDER = 'sender';

    public const WEBHOOK_URL = 'webhook_url';

    /** Stable key (stored on accounts and shipments). */
    public function key(): string;

    /** The carrier's name as the merchant knows it. */
    public function label(): string;

    /**
     * The credentials the merchant types to connect (labels in lang shipping.carriers.fields.{carrier}.{key}).
     *
     * @return list<array{key: string, secret: bool}>
     */
    public function credentialFields(): array;

    /**
     * What this carrier has: pickup locations to choose from, a courier request, package type / size, a sender address
     * typed by the merchant, a webhook address the merchant pastes in the carrier's console.
     *
     * @return list<string>
     */
    public function features(): array;

    /**
     * Checks the merchant's credentials (a wrong one → CarrierError with auth = true).
     *
     * @param  array<string, string>  $credentials
     */
    public function verify(array $credentials): CarrierProfile;

    /**
     * The carrier's delivery areas inside one of our governorates, for the merchant to pick from.
     *
     * @return list<array{id: string, name: string}>
     */
    public function districts(CarrierAccount $account, string $governorate): array;

    /** The area matching the customer's city text, when it is clear (null → the merchant picks it). */
    public function matchDistrict(CarrierAccount $account, string $governorate, ?string $city): ?string;

    public function create(CarrierAccount $account, ShipmentDraft $draft): CarrierShipment;

    public function track(CarrierAccount $account, string $trackingNumber): CarrierUpdate;

    /** Calls a shipment off (only while the carrier allows it). */
    public function cancel(CarrierAccount $account, string $trackingNumber, ?string $externalId): void;

    /**
     * The carrier's airway bills as one file (a PDF, or a ZIP of PDFs when the carrier prints one at a time).
     *
     * @param  list<string>  $trackingNumbers
     */
    public function labels(CarrierAccount $account, array $trackingNumbers, string $size): string;

    /** Asks the carrier to send a courier on a day (only with the PICKUP feature). */
    public function pickup(CarrierAccount $account, PickupRequest $request): void;

    /**
     * Whether a webhook call really comes from the carrier for this account (our secret header, or its signature).
     *
     * @param  array<string, string>  $headers  lower-case names
     * @param  array<string, mixed>  $payload
     */
    public function webhookAuthentic(CarrierAccount $account, array $headers, array $payload): bool;

    /**
     * A status update the carrier posted to our webhook (null: not about a shipment).
     *
     * @param  array<string, mixed>  $payload
     */
    public function webhook(array $payload): ?CarrierUpdate;
}
