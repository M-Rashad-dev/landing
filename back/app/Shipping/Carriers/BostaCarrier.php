<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Bosta (bosta.co), with the merchant's own API key (Bosta dashboard → Settings → API Integration). Shapes follow
 * Bosta's OpenAPI spec (docs.bosta.co/api/api.yaml, v2): deliveries, terminate, mass AWB, pickups, cities and
 * districts (public, cached a day). Status updates come to our webhook with the secret we send per delivery.
 */
final class BostaCarrier implements Carrier
{
    /** Bosta error codes the merchant can act on. */
    private const ERRORS = [
        '1007' => 'auth', '1028' => 'auth',
        '1073' => 'shipping.bosta.no_location',
        '2150' => 'shipping.bosta.open_needs_photos', '2151' => 'shipping.bosta.open_needs_photos',
        '3001' => 'shipping.bosta.area', '3002' => 'shipping.bosta.area', '3003' => 'shipping.bosta.area', '3009' => 'shipping.bosta.area',
        '3006' => 'shipping.bosta.cod', '3007' => 'shipping.bosta.cod_limit',
        '1078' => 'shipping.bosta.pickup_exists', '2024' => 'shipping.bosta.pickup_exists', '1080' => 'shipping.bosta.pickup_friday',
        '1081' => 'shipping.bosta.pickup_late', '1083' => 'shipping.bosta.pickup_past', '2022' => 'shipping.bosta.pickup_holiday',
    ];

    public function key(): string
    {
        return 'bosta';
    }

    public function label(): string
    {
        return (string) __('shipping.carriers.names.bosta');
    }

    public function verify(array $credentials): CarrierProfile
    {
        $data = $this->call(fn () => $this->http($credentials['api_key'] ?? '')->get('pickup-locations'));
        $list = is_array($data['list'] ?? null) ? $data['list'] : (array_is_list($data) ? $data : []);
        $locations = [];
        foreach ($list as $location) {
            if (! is_array($location) || ! isset($location['_id'])) {
                continue;
            }
            $locations[] = [
                'id' => (string) $location['_id'],
                'name' => (string) ($location['locationName'] ?? $location['name'] ?? $location['address']['firstLine'] ?? $location['_id']),
                'is_default' => (bool) ($location['isDefault'] ?? false),
            ];
        }
        $default = collect($list)->first(fn ($l) => is_array($l) && ($l['isDefault'] ?? false));

        return new CarrierProfile(is_array($default) ? ($default['contactPerson']['name'] ?? null) : null, $locations);
    }

    public function districts(string $governorate): array
    {
        return array_map(fn (array $a) => ['id' => $a['id'], 'name' => $a['label']], $this->areas($governorate));
    }

    /** A district whose name is the city, else the one zone with that name («zone:<id>»: Bosta takes a zone alone). */
    public function matchDistrict(string $governorate, ?string $city): ?string
    {
        $areas = $this->areas($governorate);
        $district = PlaceNames::area($city, $areas);
        if ($district !== null) {
            return $district;
        }
        $zones = [];
        foreach ($areas as $area) {
            if ($area['zone_id'] !== '') {
                $zones[$area['zone_id']] = ['id' => 'zone:'.$area['zone_id'], 'names' => $area['zone_names']];
            }
        }

        return PlaceNames::area($city, array_values($zones));
    }

    public function create(CarrierAccount $account, ShipmentDraft $draft): CarrierShipment
    {
        [$first, $last] = self::splitName($draft->receiverName);
        $body = array_filter([
            'type' => 10,
            'cod' => round($draft->cod / 100, 2),
            'specs' => ['packageType' => $draft->packageType, 'size' => $draft->size, 'packageDetails' => ['itemsCount' => max(1, $draft->itemsCount), 'description' => mb_substr($draft->description, 0, 200)]],
            'dropOffAddress' => array_filter([
                'city' => $this->cityName($draft->governorate),
                'districtId' => str_starts_with((string) $draft->districtId, 'zone:') ? null : $draft->districtId,
                'zoneId' => str_starts_with((string) $draft->districtId, 'zone:') ? substr((string) $draft->districtId, 5) : null,
                'firstLine' => mb_substr($draft->address, 0, 250),
            ]),
            'receiver' => array_filter(['firstName' => $first, 'lastName' => $last, 'phone' => $draft->phone, 'secondPhone' => $draft->phone2, 'email' => $draft->email]),
            'businessReference' => $draft->reference,
            'notes' => $draft->notes,
            'allowToOpenPackage' => $draft->allowOpen,
            'deliveryImages' => $draft->allowOpen && $draft->images !== [] ? [['type' => 'ALLOW_TO_OPEN_THE_PACKAGE', 'images' => array_slice($draft->images, 0, 10)]] : null,
            'businessLocationId' => $draft->locationId,
            'webhookUrl' => $draft->webhookUrl,
            'webhookCustomHeaders' => ['Authorization' => $draft->webhookSecret],
        ], fn ($v) => $v !== null && $v !== '');

        $data = $this->call(fn () => $this->forAccount($account)->post('deliveries?apiVersion=1', $body));
        $tracking = (string) ($data['trackingNumber'] ?? '');
        if ($tracking === '') {
            throw new CarrierError((string) __('shipping.bosta.unexpected'));
        }
        $code = isset($data['state']['code']) ? (int) $data['state']['code'] : 10;

        return new CarrierShipment(
            isset($data['_id']) ? (string) $data['_id'] : null,
            $tracking,
            new CarrierUpdate($tracking, self::state($code, null), $code, (string) ($data['state']['value'] ?? 'Pickup requested'), CarbonImmutable::now()),
        );
    }

    public function track(CarrierAccount $account, string $trackingNumber): CarrierUpdate
    {
        $data = $this->call(fn () => $this->forAccount($account)->get('deliveries/business/'.rawurlencode($trackingNumber)));
        $code = (int) ($data['state']['code'] ?? 0);
        $type = is_array($data['type'] ?? null) ? (string) ($data['type']['value'] ?? '') : (string) ($data['type'] ?? '');

        return new CarrierUpdate(
            $trackingNumber,
            self::state($code, $type),
            $code ?: null,
            isset($data['state']['value']) ? (string) $data['state']['value'] : null,
            CarbonImmutable::now(),
            isset($data['state']['exception']['reason']) ? (string) $data['state']['exception']['reason'] : null,
            isset($data['attemptsCount']) ? (int) $data['attemptsCount'] : null,
        );
    }

    public function cancel(CarrierAccount $account, string $trackingNumber): void
    {
        $this->call(fn () => $this->forAccount($account)->delete('deliveries/business/'.rawurlencode($trackingNumber).'/terminate'));
    }

    public function labels(CarrierAccount $account, array $trackingNumbers, string $size): string
    {
        $response = $this->send(fn () => $this->forAccount($account)->post('deliveries/mass-awb', [
            'trackingNumbers' => implode(',', $trackingNumbers),
            'requestedAwbType' => $size === 'A6' ? 'A6' : 'A4',
            'lang' => 'ar',
        ]));
        if (str_contains((string) $response->header('Content-Type'), 'pdf')) {
            return $response->body();
        }
        $data = $this->call($response);
        $encoded = is_string($data) ? $data : (string) ($data['data'] ?? $data['file'] ?? $data['awb'] ?? '');
        $pdf = base64_decode((string) preg_replace('/^data:application\/pdf;base64,/', '', $encoded), true);
        if ($pdf === false || ! str_starts_with($pdf, '%PDF')) {
            throw new CarrierError((string) __('shipping.bosta.labels_failed'));
        }

        return $pdf;
    }

    public function pickup(CarrierAccount $account, PickupRequest $request): void
    {
        $this->call(fn () => $this->forAccount($account)->post('pickups', array_filter([
            'scheduledDate' => $request->date,
            'businessLocationId' => $request->locationId,
            'numberOfParcels' => max(1, $request->parcels),
            'contactPerson' => array_filter(['name' => $request->contactName, 'phone' => $request->contactPhone]),
            'notes' => $request->notes,
        ], fn ($v) => $v !== null && $v !== '')));
    }

    public function webhook(array $payload): ?CarrierUpdate
    {
        $tracking = (string) ($payload['trackingNumber'] ?? '');
        if ($tracking === '' || ! isset($payload['state'])) {
            return null;
        }
        $code = (int) $payload['state'];
        $at = isset($payload['timeStamp']) && is_numeric($payload['timeStamp'])
            ? CarbonImmutable::createFromTimestampMs((int) $payload['timeStamp'])
            : CarbonImmutable::now();

        return new CarrierUpdate(
            $tracking,
            self::state($code, isset($payload['type']) ? (string) $payload['type'] : null),
            $code,
            self::codeName($code),
            $at,
            isset($payload['exceptionReason']) ? mb_substr((string) $payload['exceptionReason'], 0, 200) : null,
            isset($payload['numberOfAttempts']) ? (int) $payload['numberOfAttempts'] : null,
        );
    }

    /** Bosta's state code → ours (the delivery type tells a return trip from the way out). */
    public static function state(int $code, ?string $type): ?ShipmentState
    {
        $back = in_array(strtoupper((string) $type), ['RTO', 'CUSTOMER_RETURN_PICKUP', 'RETURN_TO_ORIGIN'], true);

        return match (true) {
            in_array($code, [10, 11, 20], true) => $back ? ShipmentState::Returning : ShipmentState::Created,
            $code === 21 => $back ? ShipmentState::Returning : ShipmentState::PickedUp,
            in_array($code, [22, 23, 24, 30, 40], true) => $back ? ShipmentState::Returning : ShipmentState::InTransit,
            $code === 41 => $back ? ShipmentState::Returning : ShipmentState::OutForDelivery,
            $code === 45 => ShipmentState::Delivered,
            in_array($code, [46, 60], true) => ShipmentState::Returned,
            in_array($code, [47, 102, 103, 105], true) => ShipmentState::Exception,
            in_array($code, [48, 49], true) => ShipmentState::Cancelled,
            $code === 100 => ShipmentState::Lost,
            $code === 101 => ShipmentState::Damaged,
            default => null,
        };
    }

    private static function codeName(int $code): ?string
    {
        return [
            10 => 'Pickup requested', 11 => 'Waiting for route', 20 => 'Route assigned', 21 => 'Picked up', 24 => 'Received at warehouse',
            30 => 'In transit', 41 => 'Out for delivery', 45 => 'Delivered', 46 => 'Returned to business', 47 => 'Exception',
            48 => 'Terminated', 49 => 'Canceled', 60 => 'Returned to stock', 100 => 'Lost', 101 => 'Damaged', 102 => 'Investigation',
            103 => 'Awaiting your action', 104 => 'Archived', 105 => 'On hold',
        ][$code] ?? null;
    }

    /**
     * Bosta's areas in a governorate: each district with its zone, Arabic first.
     *
     * @return list<array{id: string, label: string, names: list<string>, zone_id: string, zone_names: list<string>}>
     */
    private function areas(string $governorate): array
    {
        $cityId = PlaceNames::governorate($governorate, array_map(fn (array $c) => ['id' => $c['id'], 'names' => $c['names']], $this->cities()));
        if ($cityId === null) {
            throw new CarrierError((string) __('shipping.bosta.no_city', ['governorate' => $governorate]));
        }

        return Cache::remember('shipping:bosta:districts:'.$cityId, now()->addDay(), function () use ($cityId): array {
            $data = $this->call(fn () => $this->http(null)->get('cities/'.rawurlencode($cityId).'/districts'));
            $areas = [];
            foreach ((array_is_list($data) ? $data : (array) ($data['list'] ?? [])) as $d) {
                $id = (string) ($d['districtId'] ?? $d['districtI'] ?? '');
                if ($id === '' || ($d['dropOffAvailability'] ?? true) === false) {
                    continue;
                }
                $zone = (string) ($d['zoneOtherName'] ?? $d['zoneName'] ?? '');
                $district = (string) ($d['districtOtherName'] ?? $d['districtName'] ?? '');
                // «الزمالك» alone, or «مدينة نصر - الحي العاشر» when the district doesn't already say its zone.
                $alone = $zone === '' || str_starts_with(PlaceNames::key($district), PlaceNames::key($zone));
                $areas[] = [
                    'id' => $id,
                    'label' => $alone ? $district : $zone.' - '.$district,
                    'names' => array_values(array_filter([(string) ($d['districtOtherName'] ?? ''), (string) ($d['districtName'] ?? '')])),
                    'zone_id' => (string) ($d['zoneId'] ?? ''),
                    'zone_names' => array_values(array_filter([(string) ($d['zoneOtherName'] ?? ''), (string) ($d['zoneName'] ?? '')])),
                ];
            }

            return $areas;
        });
    }

    /** @return list<array{id: string, name: string, names: list<string>}> */
    private function cities(): array
    {
        return Cache::remember('shipping:bosta:cities', now()->addDay(), function (): array {
            $data = $this->call(fn () => $this->http(null)->get('cities', ['countryId' => '60e4482c7cb7d4bc4849c4d5']));
            $cities = [];
            foreach ((array) ($data['list'] ?? (array_is_list($data) ? $data : [])) as $c) {
                if (! is_array($c) || ! isset($c['_id']) || ($c['dropOffAvailability'] ?? true) === false) {
                    continue;
                }
                $cities[] = ['id' => (string) $c['_id'], 'name' => (string) ($c['name'] ?? ''), 'names' => array_values(array_filter([(string) ($c['nameAr'] ?? ''), (string) ($c['name'] ?? ''), (string) ($c['alias'] ?? '')]))];
            }

            return $cities;
        });
    }

    /** The city name Bosta expects in the drop-off address. */
    private function cityName(string $governorate): string
    {
        $cities = $this->cities();
        $id = PlaceNames::governorate($governorate, $cities);
        foreach ($cities as $city) {
            if ($city['id'] === $id) {
                return $city['name'];
            }
        }
        throw new CarrierError((string) __('shipping.bosta.no_city', ['governorate' => $governorate]));
    }

    /** @return array{0: string, 1: string|null} */
    private static function splitName(string $name): array
    {
        $parts = preg_split('/\s+/u', trim($name), 2) ?: [$name];

        return [$parts[0] !== '' ? $parts[0] : $name, $parts[1] ?? null];
    }

    private function forAccount(CarrierAccount $account): PendingRequest
    {
        return $this->http((string) (($account->credentials ?? [])['api_key'] ?? ''));
    }

    private function http(?string $key): PendingRequest
    {
        $request = Http::baseUrl(rtrim((string) config('shipping.bosta.base_url'), '/').'/')
            ->acceptJson()
            ->asJson()
            ->timeout((int) config('shipping.bosta.timeout', 20))
            ->retry(2, 500, fn ($e) => $e instanceof ConnectionException, throw: false);

        return $key === null ? $request : $request->withHeaders(['Authorization' => $key]);
    }

    /** @param callable(): Response $request */
    private function send(callable $request): Response
    {
        try {
            return $request();
        } catch (ConnectionException) {
            throw new CarrierError((string) __('shipping.bosta.unreachable'));
        }
    }

    /**
     * The response's `data`, or a CarrierError with words the merchant can act on.
     *
     * @param  Response|callable(): Response  $response
     * @return array<mixed>|string
     */
    private function call(Response|callable $response): array|string
    {
        if (! $response instanceof Response) {
            $response = $this->send($response);
        }
        $json = $response->json();
        if ($response->successful() && (! is_array($json) || ($json['success'] ?? true) !== false)) {
            $data = is_array($json) ? ($json['data'] ?? $json) : [];

            return is_string($data) ? $data : (array) $data;
        }
        $code = is_array($json) && isset($json['errorCode']) ? (string) $json['errorCode'] : null;
        $message = is_array($json) ? trim((string) ($json['message'] ?? '')) : '';
        $known = $code !== null ? (self::ERRORS[$code] ?? null) : null;
        if ($known === 'auth' || in_array($response->status(), [401, 403], true)) {
            throw new CarrierError((string) __('shipping.bosta.auth'), auth: true, carrierCode: $code);
        }
        if ($known !== null) {
            throw new CarrierError((string) __($known), carrierCode: $code);
        }
        if ($response->serverError()) {
            throw new CarrierError((string) __('shipping.bosta.unreachable'), carrierCode: $code);
        }

        throw new CarrierError((string) __('shipping.bosta.refused', ['reason' => $message !== '' ? mb_substr($message, 0, 160) : (string) $response->status()]), carrierCode: $code);
    }
}
