<?php

declare(strict_types=1);

namespace App\Shipping\Carriers;

use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use App\Support\CairoTime;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;
use ZipArchive;

/**
 * J&T Express Egypt through its JMS open platform (open.jtjms-eg.com), with the merchant's own account: the API
 * Account + Private Key of the open platform and the Customer Code + password of his J&T contract. Every call is a
 * form post of `bizContent` (JSON) with headers apiAccount, digest = base64(md5(bizContent + privateKey)) and a
 * millisecond timestamp; business calls carry the customer's digest = base64(md5(customerCode +
 * upper(md5hex(password + "jadada236t2")) + privateKey)) — both from J&T's own SDK (yl-jms-isv-sdk) and samples.
 * Status pushes are signed the same way, so they are checked with the private key.
 */
final class JtCarrier implements Carrier
{
    private const SALT = 'jadada236t2';

    /** J&T's scan type codes (logistics/trace, track push) → ours. */
    private const SCANS = [
        1 => ShipmentState::PickedUp, 2 => ShipmentState::InTransit, 3 => ShipmentState::InTransit, 4 => ShipmentState::InTransit,
        5 => ShipmentState::OutForDelivery, 6 => ShipmentState::InTransit, 7 => ShipmentState::InTransit, 8 => ShipmentState::InTransit,
        9 => ShipmentState::InTransit, 10 => ShipmentState::Delivered, 11 => ShipmentState::Exception, 12 => ShipmentState::Exception,
        13 => ShipmentState::Returned, 14 => ShipmentState::Returning, 15 => ShipmentState::InTransit,
    ];

    public function key(): string
    {
        return 'jt';
    }

    public function label(): string
    {
        return (string) __('shipping.carriers.names.jt');
    }

    public function credentialFields(): array
    {
        return [
            ['key' => 'customer_code', 'secret' => false],
            ['key' => 'password', 'secret' => true],
            ['key' => 'api_account', 'secret' => false],
            ['key' => 'private_key', 'secret' => true],
        ];
    }

    public function features(): array
    {
        return [self::SENDER, self::WEBHOOK_URL];
    }

    public function verify(array $credentials): CarrierProfile
    {
        $this->call($credentials, 'vip/checkCusPwd', $this->customer($credentials));

        return new CarrierProfile((string) ($credentials['customer_code'] ?? ''), []);
    }

    public function districts(CarrierAccount $account, string $governorate): array
    {
        return array_map(fn (array $a) => ['id' => $a['id'], 'name' => $a['label']], $this->areas($account, $governorate));
    }

    public function matchDistrict(CarrierAccount $account, string $governorate, ?string $city): ?string
    {
        $areas = $this->areas($account, $governorate);
        $match = PlaceNames::area($city, array_map(fn (array $a) => ['id' => $a['id'], 'names' => [$a['area']]], $areas));
        if ($match !== null) {
            return $match;
        }
        // A city with one delivery area only.
        $cities = [];
        foreach ($areas as $a) {
            $cities[$a['city']][] = $a['id'];
        }
        $one = array_filter($cities, fn (array $ids) => count($ids) === 1);

        return PlaceNames::area($city, array_map(fn (string $name, array $ids) => ['id' => $ids[0], 'names' => [$name]], array_keys($one), array_values($one)));
    }

    public function create(CarrierAccount $account, ShipmentDraft $draft): CarrierShipment
    {
        $credentials = $account->credentials ?? [];
        [$prov, $city, $area] = $this->place($account, $draft->governorate, (string) $draft->districtId);
        $sender = $this->sender($account);
        $reference = mb_substr(preg_replace('/[^A-Za-z0-9-]/', '', $draft->reference).'-'.Str::lower(Str::random(6)), 0, 50);
        $cod = number_format($draft->cod / 100, 2, '.', '');

        $data = $this->call($credentials, 'order/addOrder', [
            ...$this->customer($credentials),
            'txlogisticId' => $reference,
            'expressType' => 'EZ',
            'orderType' => '1',
            'serviceType' => (string) $account->setting('service_type', '01') === '02' ? '02' : '01',
            'deliveryType' => '04',
            'payType' => 'PP_PM',
            'operateType' => 1,
            'sender' => $sender,
            'receiver' => [
                'name' => mb_substr($draft->receiverName, 0, 50),
                'mobile' => $draft->phone,
                'phone' => $draft->phone2 ?: $draft->phone,
                'countryCode' => 'EGY',
                'prov' => $prov,
                'city' => $city,
                'area' => $area,
                'street' => mb_substr($draft->address, 0, 200),
                'mailBox' => (string) ($draft->email ?? ''),
            ],
            'goodsType' => (string) $account->setting('goods_type', 'ITN16'),
            'weight' => (string) $account->setting('weight', '1'),
            'totalQuantity' => (string) max(1, $draft->itemsCount),
            'itemsValue' => $cod,
            'priceCurrency' => 'EGP',
            'remark' => mb_substr((string) $draft->notes, 0, 200),
            'items' => [[
                'itemName' => mb_substr($draft->description, 0, 30),
                'number' => max(1, $draft->itemsCount),
                'itemValue' => $cod,
                'priceCurrency' => 'EGP',
                'desc' => mb_substr($draft->description, 0, 100),
            ]],
        ]);
        $billCode = (string) ($data['billCode'] ?? '');
        if ($billCode === '') {
            throw new CarrierError((string) __('shipping.jt.unexpected'));
        }

        return new CarrierShipment((string) ($data['txlogisticId'] ?? $reference), $billCode, new CarrierUpdate($billCode, ShipmentState::Created, null, 'Order created', CarbonImmutable::now()));
    }

    public function track(CarrierAccount $account, string $trackingNumber): CarrierUpdate
    {
        $data = $this->call($account->credentials ?? [], 'logistics/trace', ['billCodes' => $trackingNumber]);
        $row = collect(array_is_list($data) ? $data : [$data])->first(fn ($r) => is_array($r) && ($r['billCode'] ?? null) === $trackingNumber) ?? [];
        $update = $this->latest($trackingNumber, (array) ($row['details'] ?? []));

        return $update ?? new CarrierUpdate($trackingNumber, null, null, null, CarbonImmutable::now());
    }

    public function cancel(CarrierAccount $account, string $trackingNumber, ?string $externalId): void
    {
        $credentials = $account->credentials ?? [];
        $this->call($credentials, 'order/cancelOrder', [
            ...$this->customer($credentials),
            'orderType' => '1',
            'txlogisticId' => (string) $externalId,
            'reason' => 'Cancelled by the merchant',
        ]);
    }

    public function labels(CarrierAccount $account, array $trackingNumbers, string $size): string
    {
        $credentials = $account->credentials ?? [];
        $files = [];
        foreach ($trackingNumbers as $billCode) {
            $data = $this->call($credentials, 'order/printOrder', [
                ...$this->customer($credentials),
                'billCode' => $billCode,
                'printSize' => $size === 'A4' ? 2 : 0,
                'printCod' => 1,
            ]);
            $pdf = base64_decode((string) ($data['base64EncodeContent'] ?? ''), true);
            if ($pdf === false || ! str_starts_with($pdf, '%PDF')) {
                throw new CarrierError((string) __('shipping.jt.labels_failed'));
            }
            $files[$billCode] = $pdf;
        }
        if (count($files) === 1) {
            return (string) reset($files);
        }

        // One PDF per shipment at J&T: a ZIP holds them all.
        $path = tempnam(sys_get_temp_dir(), 'jt');
        $zip = new ZipArchive;
        $zip->open($path, ZipArchive::OVERWRITE);
        foreach ($files as $billCode => $pdf) {
            $zip->addFromString(preg_replace('/[^A-Za-z0-9-]/', '', (string) $billCode).'.pdf', $pdf);
        }
        $zip->close();
        $bytes = (string) file_get_contents($path);
        @unlink($path);

        return $bytes;
    }

    public function pickup(CarrierAccount $account, PickupRequest $request): void
    {
        // J&T sends its courier for every shipment by itself (service type «من عندي»).
        throw new CarrierError((string) __('shipping.jt.no_pickup'));
    }

    public function webhookAuthentic(CarrierAccount $account, array $headers, array $payload): bool
    {
        $biz = (string) ($payload['bizContent'] ?? '');
        $key = (string) (($account->credentials ?? [])['private_key'] ?? '');

        return $biz !== '' && $key !== '' && hash_equals(base64_encode(md5($biz.$key, true)), (string) ($headers['digest'] ?? ''));
    }

    /** A track push ({billCode, details[]}) or an order status push ({billCode, scanType: 已揽收 / 已取消…}). */
    public function webhook(array $payload): ?CarrierUpdate
    {
        $biz = json_decode((string) ($payload['bizContent'] ?? ''), true);
        if (! is_array($biz) || ! isset($biz['billCode'])) {
            return null;
        }
        $billCode = (string) $biz['billCode'];
        if (isset($biz['details']) && is_array($biz['details'])) {
            return $this->latest($billCode, $biz['details']);
        }
        $state = match ((string) ($biz['scanType'] ?? '')) {
            '已揽收', '已取件' => ShipmentState::PickedUp,
            '已取消' => ShipmentState::Cancelled,
            default => null,
        };

        return $state === null ? null : new CarrierUpdate($billCode, $state, null, (string) $biz['scanType'], self::time($biz['time'] ?? null), isset($biz['reason']) ? mb_substr((string) $biz['reason'], 0, 200) : null);
    }

    /** J&T's scan → ours: by its code, else by its words (Arabic / English / Chinese names seen in the docs). */
    public static function state(?int $code, ?string $scanType): ?ShipmentState
    {
        if ($code !== null && isset(self::SCANS[$code])) {
            return self::SCANS[$code];
        }
        $type = mb_strtolower((string) $scanType);

        return match (true) {
            str_contains($type, 'return sign') || str_contains($type, '退件签收') => ShipmentState::Returned,
            str_contains($type, 'return') || str_contains($type, '退件') => ShipmentState::Returning,
            str_contains($type, 'sign') || str_contains($type, '签收') => ShipmentState::Delivered,
            str_contains($type, 'problem') || str_contains($type, '问题') => ShipmentState::Exception,
            str_contains($type, 'delivery') || str_contains($type, '派件') || str_contains($type, '出仓') => ShipmentState::OutForDelivery,
            str_contains($type, 'pickup') || str_contains($type, '揽收') => ShipmentState::PickedUp,
            $type !== '' => ShipmentState::InTransit,
            default => null,
        };
    }

    /** @param list<mixed> $details */
    private function latest(string $billCode, array $details): ?CarrierUpdate
    {
        $rows = array_values(array_filter($details, 'is_array'));
        if ($rows === []) {
            return null;
        }
        usort($rows, fn (array $a, array $b) => strcmp((string) ($a['scanTime'] ?? ''), (string) ($b['scanTime'] ?? '')));
        $last = $rows[count($rows) - 1];
        $code = isset($last['scanTypeCode']) && is_numeric($last['scanTypeCode']) ? (int) $last['scanTypeCode'] : null;

        return new CarrierUpdate(
            $billCode,
            self::state($code, isset($last['scanType']) ? (string) $last['scanType'] : null),
            $code,
            isset($last['scanType']) ? mb_substr((string) $last['scanType'], 0, 80) : null,
            self::time($last['scanTime'] ?? null),
            isset($last['probleDescription']) && $last['probleDescription'] !== '' ? mb_substr((string) $last['probleDescription'], 0, 200) : null,
        );
    }

    /** J&T's «yyyy-MM-dd HH:mm:ss», Cairo time. */
    private static function time(mixed $value): CarbonImmutable
    {
        try {
            return is_string($value) && $value !== '' ? CarbonImmutable::parse($value, CairoTime::ZONE)->utc() : CarbonImmutable::now();
        } catch (Throwable) {
            return CarbonImmutable::now();
        }
    }

    /**
     * The serviceable places of one governorate (J&T's online/pca list, cached a day).
     *
     * @return list<array{id: string, label: string, prov: string, city: string, area: string}>
     */
    private function areas(CarrierAccount $account, string $governorate): array
    {
        $all = Cache::remember('shipping:jt:pca', now()->addDay(), function () use ($account): array {
            $data = $this->call($account->credentials ?? [], 'online/pca', ['type' => '4']);
            $rows = array_is_list($data) ? $data : (isset($data['prov']) ? [$data] : (array) ($data['list'] ?? []));

            return array_values(array_filter(array_map(fn ($r) => is_array($r) && isset($r['prov'], $r['city'])
                ? ['prov' => (string) $r['prov'], 'city' => (string) $r['city'], 'area' => (string) ($r['area'] ?? $r['city'])]
                : null, $rows)));
        });
        $provs = array_values(array_unique(array_column($all, 'prov')));
        $prov = PlaceNames::governorate($governorate, array_map(fn (string $p) => ['id' => $p, 'names' => [$p]], $provs));
        if ($prov === null) {
            throw new CarrierError((string) __('shipping.jt.no_city', ['governorate' => $governorate]));
        }
        $areas = [];
        foreach ($all as $row) {
            if ($row['prov'] === $prov) {
                $alone = PlaceNames::key($row['city']) === PlaceNames::key($row['area']);
                $areas[] = ['id' => $row['city'].'|'.$row['area'], 'label' => $alone ? $row['area'] : $row['city'].' - '.$row['area'], ...$row];
            }
        }

        return $areas;
    }

    /** @return array{0: string, 1: string, 2: string} J&T's prov / city / area for an area id («city|area»). */
    private function place(CarrierAccount $account, string $governorate, string $areaId): array
    {
        foreach ($this->areas($account, $governorate) as $area) {
            if ($area['id'] === $areaId) {
                return [$area['prov'], $area['city'], $area['area']];
            }
        }
        throw new CarrierError((string) __('shipping.jt.area'));
    }

    /** @return array<string, string> the store's pickup address (settings) in J&T's shape */
    private function sender(CarrierAccount $account): array
    {
        $name = trim((string) $account->setting('sender_name', ''));
        $phone = trim((string) $account->setting('sender_phone', ''));
        $governorate = trim((string) $account->setting('sender_governorate', ''));
        $areaId = trim((string) $account->setting('sender_area', ''));
        $street = trim((string) $account->setting('sender_street', ''));
        if ($name === '' || $phone === '' || $governorate === '' || $areaId === '' || $street === '') {
            throw new CarrierError((string) __('shipping.jt.sender_missing'));
        }
        [$prov, $city, $area] = $this->place($account, $governorate, $areaId);

        return ['name' => mb_substr($name, 0, 50), 'mobile' => $phone, 'phone' => $phone, 'countryCode' => 'EGY', 'prov' => $prov, 'city' => $city, 'area' => $area, 'street' => mb_substr($street, 0, 200)];
    }

    /**
     * The customer part of business calls: his code and its digest.
     *
     * @param  array<string, string>  $credentials
     * @return array{customerCode: string, digest: string}
     */
    private function customer(array $credentials): array
    {
        $code = (string) ($credentials['customer_code'] ?? '');
        $password = (string) ($credentials['password'] ?? '');
        // J&T sometimes hands out the password already hashed (32 upper-case hex): use it as is.
        $cipher = preg_match('/^[A-F0-9]{32}$/', $password) === 1 ? $password : strtoupper(md5($password.self::SALT));

        return ['customerCode' => $code, 'digest' => base64_encode(md5($code.$cipher.(string) ($credentials['private_key'] ?? ''), true))];
    }

    /**
     * One signed call; returns `data`, or a CarrierError the merchant can act on.
     *
     * @param  array<string, string>  $credentials
     * @param  array<string, mixed>  $biz
     * @return array<mixed>
     */
    private function call(array $credentials, string $path, array $biz): array
    {
        $json = (string) json_encode($biz, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $key = (string) ($credentials['private_key'] ?? '');
        try {
            $response = Http::baseUrl(rtrim((string) config('shipping.jt.base_url'), '/').'/')
                ->acceptJson()
                ->asForm()
                ->timeout((int) config('shipping.jt.timeout', 20))
                ->retry(2, 500, fn ($e) => $e instanceof ConnectionException, throw: false)
                ->withHeaders(['apiAccount' => (string) ($credentials['api_account'] ?? ''), 'digest' => base64_encode(md5($json.$key, true)), 'timestamp' => (string) now()->getTimestampMs()])
                ->post($path, ['bizContent' => $json]);
        } catch (ConnectionException) {
            throw new CarrierError((string) __('shipping.jt.unreachable'));
        }

        return $this->data($response);
    }

    /** @return array<mixed> */
    private function data(Response $response): array
    {
        $body = $response->json();
        if (! $response->successful() || ! is_array($body)) {
            throw new CarrierError((string) __($response->serverError() ? 'shipping.jt.unreachable' : 'shipping.jt.unexpected'));
        }
        if ((string) ($body['code'] ?? '') !== '1') {
            $message = trim((string) ($body['msg'] ?? ''));
            $auth = preg_match('/digest|sign|password|pwd|customer|apiAccount|account|签名|密码/i', $message) === 1;
            throw new CarrierError($auth ? (string) __('shipping.jt.auth') : (string) __('shipping.jt.refused', ['reason' => mb_substr($message !== '' ? $message : (string) ($body['code'] ?? ''), 0, 160)]), auth: $auth, carrierCode: (string) ($body['code'] ?? ''));
        }
        $data = $body['data'] ?? [];

        return is_array($data) ? $data : [];
    }
}
