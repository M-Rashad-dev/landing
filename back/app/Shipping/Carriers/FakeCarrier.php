<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use Carbon\CarbonImmutable;

/**
 * Stands in for any carrier (config shipping.driver = fake): tests, e2e and a dev box without carrier accounts.
 * Keys: «bad» fails as a wrong key; everything else works. Keeps what it was asked, for tests to read.
 */
final class FakeCarrier implements Carrier
{
    /** @var list<ShipmentDraft> */
    public array $created = [];

    /** @var list<string> */
    public array $cancelled = [];

    /** @var list<PickupRequest> */
    public array $pickups = [];

    /** @var array<string, ShipmentState> what track() answers per tracking number */
    public array $states = [];

    /** The next create() fails with this (then clears). */
    public ?CarrierError $failNext = null;

    private static int $next = 1000;

    public function __construct(private readonly string $key, private readonly string $label) {}

    public function key(): string
    {
        return $this->key;
    }

    public function label(): string
    {
        return $this->label;
    }

    public function verify(array $credentials): CarrierProfile
    {
        if (($credentials['api_key'] ?? '') === 'bad' || trim((string) ($credentials['api_key'] ?? '')) === '') {
            throw new CarrierError((string) __('shipping.bosta.auth'), auth: true);
        }

        return new CarrierProfile('حساب تجريبي', [
            ['id' => 'loc-main', 'name' => 'المخزن الرئيسي', 'is_default' => true],
            ['id' => 'loc-branch', 'name' => 'الفرع', 'is_default' => false],
        ]);
    }

    public function districts(string $governorate): array
    {
        return array_map(fn (array $a) => ['id' => $a['id'], 'name' => $a['names'][0]], $this->areas());
    }

    public function matchDistrict(string $governorate, ?string $city): ?string
    {
        return PlaceNames::area($city, $this->areas());
    }

    public function create(CarrierAccount $account, ShipmentDraft $draft): CarrierShipment
    {
        if ($this->failNext !== null) {
            [$error, $this->failNext] = [$this->failNext, null];
            throw $error;
        }
        $this->created[] = $draft;
        $tracking = 'FK'.(++self::$next);
        $this->states[$tracking] = ShipmentState::Created;

        return new CarrierShipment('fake-'.$tracking, $tracking, new CarrierUpdate($tracking, ShipmentState::Created, 10, 'Pickup requested', CarbonImmutable::now()));
    }

    public function track(CarrierAccount $account, string $trackingNumber): CarrierUpdate
    {
        $state = $this->states[$trackingNumber] ?? ShipmentState::Created;

        return new CarrierUpdate($trackingNumber, $state, null, $state->name, CarbonImmutable::now());
    }

    public function cancel(CarrierAccount $account, string $trackingNumber): void
    {
        $this->cancelled[] = $trackingNumber;
        $this->states[$trackingNumber] = ShipmentState::Cancelled;
    }

    public function labels(CarrierAccount $account, array $trackingNumbers, string $size): string
    {
        return "%PDF-1.4\n% fake airway bills: ".implode(',', $trackingNumbers)." ({$size})\n%%EOF\n";
    }

    public function pickup(CarrierAccount $account, PickupRequest $request): void
    {
        $this->pickups[] = $request;
    }

    /** Fake webhook body: {trackingNumber, state: one of ShipmentState values, note?}. */
    public function webhook(array $payload): ?CarrierUpdate
    {
        $state = ShipmentState::tryFrom((string) ($payload['state'] ?? ''));
        if (! isset($payload['trackingNumber']) || $state === null) {
            return null;
        }
        $at = isset($payload['at']) ? CarbonImmutable::parse((string) $payload['at']) : CarbonImmutable::now();

        return new CarrierUpdate((string) $payload['trackingNumber'], $state, null, $state->name, $at, isset($payload['note']) ? (string) $payload['note'] : null);
    }

    /** @return list<array{id: string, names: list<string>}> */
    private function areas(): array
    {
        return [
            ['id' => 'd-nasr', 'names' => ['مدينة نصر', 'Nasr City']],
            ['id' => 'd-maadi', 'names' => ['المعادي', 'Maadi']],
            ['id' => 'd-smouha', 'names' => ['سموحة', 'Smouha']],
        ];
    }
}
