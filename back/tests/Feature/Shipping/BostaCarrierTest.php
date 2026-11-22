<?php

declare(strict_types=1);

use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use App\Shipping\Carriers\BostaCarrier;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\PlaceNames;
use App\Shipping\Carriers\ShipmentDraft;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

/** Bosta's real request and response shapes (docs.bosta.co/api/api.yaml), against a faked HTTP layer. */
function bostaHttp(array $extra = []): void
{
    Http::fake($extra + [
        'app.bosta.co/api/v2/cities?*' => Http::response(['success' => true, 'data' => ['list' => [
            ['_id' => 'CAI', 'name' => 'Cairo', 'nameAr' => 'القاهرة', 'code' => 'EG-01', 'dropOffAvailability' => true],
            ['_id' => 'ALX', 'name' => 'Alexandria', 'nameAr' => 'الإسكندرية', 'code' => 'EG-02', 'dropOffAvailability' => true],
        ]]]),
        'app.bosta.co/api/v2/cities/CAI/districts' => Http::response(['success' => true, 'data' => [
            ['zoneId' => 'z1', 'zoneName' => 'Nasr City', 'zoneOtherName' => 'مدينة نصر', 'districtId' => 'dNasr1', 'districtName' => 'Nasr City - 1st District', 'districtOtherName' => 'مدينه نصر - الحي الأول', 'dropOffAvailability' => true],
            ['zoneId' => 'z2', 'zoneName' => 'Maadi', 'zoneOtherName' => 'المعادى', 'districtId' => 'dMaadi', 'districtName' => 'Maadi', 'districtOtherName' => 'المعادي', 'dropOffAvailability' => true],
            ['zoneId' => 'z3', 'zoneName' => 'Closed', 'zoneOtherName' => 'مقفولة', 'districtId' => 'dClosed', 'districtName' => 'Closed', 'districtOtherName' => 'مقفولة', 'dropOffAvailability' => false],
        ]]),
    ]);
}

function bostaAccount(): CarrierAccount
{
    return new CarrierAccount(['carrier' => 'bosta', 'credentials' => ['api_key' => 'KEY-1']]);
}

function bostaDraft(array $override = []): ShipmentDraft
{
    return new ShipmentDraft(...$override + [
        'reference' => '7001', 'receiverName' => 'محمد أحمد علي', 'phone' => '+201011112222', 'phone2' => null, 'email' => null,
        'governorate' => 'القاهرة', 'city' => 'المعادي', 'address' => 'شارع 9، المعادي', 'districtId' => 'dMaadi', 'cod' => 45050,
        'itemsCount' => 2, 'description' => '2 × تيشيرت', 'notes' => 'اتصل قبلها', 'allowOpen' => false, 'images' => [],
        'locationId' => 'loc-1', 'packageType' => 'Parcel', 'size' => 'SMALL', 'webhookUrl' => 'https://app.test/api/webhooks/shipping/bosta/t', 'webhookSecret' => 'S3CRET',
    ]);
}

it('matches governorates and areas whatever the spelling', function () {
    expect(PlaceNames::key('الإسكندرية'))->toBe(PlaceNames::key('اسكندريه'))
        ->and(PlaceNames::key('بور سعيد'))->toBe(PlaceNames::key('بورسعيد'))
        ->and(PlaceNames::governorate('كفر الشيخ', [['id' => 'K', 'names' => ['Kafr El-Sheikh']]]))->toBe('K')
        ->and(PlaceNames::area('المعادى', [['id' => 'a', 'names' => ['المعادي']], ['id' => 'b', 'names' => ['حلوان']]]))->toBe('a')
        // Two areas with the same name: the merchant picks.
        ->and(PlaceNames::area('الحي الأول', [['id' => 'a', 'names' => ['الحي الأول']], ['id' => 'b', 'names' => ['الحى الاول']]]))->toBeNull();
});

it('lists the areas of a governorate and matches the customer\'s city', function () {
    bostaHttp();
    $bosta = new BostaCarrier;

    expect($bosta->districts(bostaAccount(), 'القاهرة'))->toBe([['id' => 'dNasr1', 'name' => 'مدينه نصر - الحي الأول'], ['id' => 'dMaadi', 'name' => 'المعادي']])
        ->and($bosta->matchDistrict(bostaAccount(), 'القاهرة', 'المعادى'))->toBe('dMaadi')
        // Only the zone's name: the zone goes (Bosta takes a zone without a district).
        ->and($bosta->matchDistrict(bostaAccount(), 'القاهرة', 'Nasr City'))->toBe('zone:z1')
        ->and($bosta->matchDistrict(bostaAccount(), 'القاهرة', 'مكان تاني'))->toBeNull();
    expect(fn () => $bosta->districts(bostaAccount(), 'أسوان'))->toThrow(CarrierError::class, 'بوسطة مش بتوصّل لمحافظة أسوان.');
});

it('creates a delivery with the merchant\'s key, our secret and the right address', function () {
    bostaHttp(['app.bosta.co/api/v2/deliveries*' => Http::response(['success' => true, 'message' => 'Done', 'data' => ['_id' => 'X9', 'trackingNumber' => '5108002', 'state' => ['code' => 10, 'value' => 'Pickup requested']]])]);

    $made = (new BostaCarrier)->create(bostaAccount(), bostaDraft());

    expect($made->trackingNumber)->toBe('5108002')->and($made->externalId)->toBe('X9')->and($made->update->state)->toBe(ShipmentState::Created);
    Http::assertSent(function (Request $request) {
        if (! str_contains($request->url(), '/deliveries?apiVersion=1')) {
            return false;
        }
        $body = $request->data();

        return $request->hasHeader('Authorization', 'KEY-1')
            && $body['type'] === 10 && $body['cod'] === 450.5
            && $body['dropOffAddress'] === ['city' => 'Cairo', 'districtId' => 'dMaadi', 'firstLine' => 'شارع 9، المعادي']
            && $body['receiver'] === ['firstName' => 'محمد', 'lastName' => 'أحمد علي', 'phone' => '+201011112222']
            && $body['businessReference'] === '7001' && $body['businessLocationId'] === 'loc-1'
            && $body['specs']['packageDetails']['itemsCount'] === 2
            && $body['webhookCustomHeaders'] === ['Authorization' => 'S3CRET']
            && ! isset($body['deliveryImages']);
    });
});

it('sends a zone alone when only the zone is known', function () {
    bostaHttp(['app.bosta.co/api/v2/deliveries*' => Http::response(['success' => true, 'data' => ['_id' => 'X9', 'trackingNumber' => '1', 'state' => ['code' => 10]]])]);
    (new BostaCarrier)->create(bostaAccount(), bostaDraft(['districtId' => 'zone:z1']));

    Http::assertSent(fn (Request $r) => str_contains($r->url(), 'deliveries?') && $r['dropOffAddress']['zoneId'] === 'z1' && ! isset($r['dropOffAddress']['districtId']));
});

it('turns Bosta\'s errors into words the merchant can act on', function () {
    bostaHttp(['app.bosta.co/api/v2/deliveries*' => Http::sequence()
        ->push(['success' => false, 'message' => 'District Not Found', 'errorCode' => 3003], 400)
        ->push(['success' => false, 'message' => 'User is not authorized!', 'errorCode' => 1007], 401)
        ->push(['success' => false, 'message' => 'Something odd', 'errorCode' => 9999], 400)]);
    $bosta = new BostaCarrier;

    expect(fn () => $bosta->create(bostaAccount(), bostaDraft()))->toThrow(CarrierError::class, (string) __('shipping.bosta.area'));
    try {
        $bosta->create(bostaAccount(), bostaDraft());
    } catch (CarrierError $e) {
        expect($e->auth)->toBeTrue();
    }
    expect(fn () => $bosta->create(bostaAccount(), bostaDraft()))->toThrow(CarrierError::class, 'بوسطة رفضت الطلب: Something odd');
});

it('reads Bosta\'s webhook, on the way out and on the way back', function () {
    $bosta = new BostaCarrier;
    $out = $bosta->webhook(['_id' => 'X9', 'trackingNumber' => '5108002', 'state' => 41, 'type' => 'SEND', 'timeStamp' => 1763700000000, 'numberOfAttempts' => 1]);
    $back = $bosta->webhook(['trackingNumber' => '5108002', 'state' => 21, 'type' => 'RTO']);
    $problem = $bosta->webhook(['trackingNumber' => '5108002', 'state' => 47, 'exceptionReason' => 'Customer not answering', 'exceptionCode' => 7]);

    expect($out->state)->toBe(ShipmentState::OutForDelivery)->and($out->at->getTimestampMs())->toBe(1763700000000)->and($out->attempts)->toBe(1)
        ->and($back->state)->toBe(ShipmentState::Returning)
        ->and($problem->state)->toBe(ShipmentState::Exception)->and($problem->note)->toBe('Customer not answering')
        ->and(BostaCarrier::state(45, 'SEND'))->toBe(ShipmentState::Delivered)
        ->and(BostaCarrier::state(46, 'RTO'))->toBe(ShipmentState::Returned)
        ->and(BostaCarrier::state(101, null))->toBe(ShipmentState::Damaged)
        ->and(BostaCarrier::state(104, null))->toBeNull()
        ->and($bosta->webhook(['hello' => 'world']))->toBeNull();
});

it('checks the key with the pickup locations, prints airway bills and terminates', function () {
    $pdf = "%PDF-1.4\nfake\n%%EOF";
    bostaHttp([
        'app.bosta.co/api/v2/pickup-locations' => Http::response(['success' => true, 'data' => ['total' => 2, 'list' => [
            ['_id' => 'L1', 'locationName' => 'Original Business Location', 'isDefault' => false],
            ['_id' => 'L2', 'locationName' => 'المخزن', 'isDefault' => true, 'contactPerson' => ['name' => 'متجر حبة']],
        ]]]),
        'app.bosta.co/api/v2/deliveries/mass-awb' => Http::response(['success' => true, 'data' => base64_encode($pdf)]),
        'app.bosta.co/api/v2/deliveries/business/5108002/terminate' => Http::response(['success' => true, 'message' => 'Delivery has been terminated successfully.']),
    ]);
    $bosta = new BostaCarrier;

    $profile = $bosta->verify(['api_key' => 'KEY-1']);
    expect($profile->defaultLocation())->toBe('L2')->and($profile->accountName)->toBe('متجر حبة')->and($profile->locations)->toHaveCount(2);
    expect($bosta->labels(bostaAccount(), ['5108002', '5108003'], 'A6'))->toBe($pdf);
    $bosta->cancel(bostaAccount(), '5108002', 'X9');

    Http::assertSent(fn (Request $r) => str_contains($r->url(), 'mass-awb') && $r['trackingNumbers'] === '5108002,5108003' && $r['requestedAwbType'] === 'A6' && $r['lang'] === 'ar');
    Http::assertSent(fn (Request $r) => $r->method() === 'DELETE' && str_contains($r->url(), 'deliveries/business/5108002/terminate'));
});
