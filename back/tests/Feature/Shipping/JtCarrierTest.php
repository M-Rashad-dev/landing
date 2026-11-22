<?php

declare(strict_types=1);

use App\Enums\ShipmentState;
use App\Models\CarrierAccount;
use App\Shipping\Carriers\CarrierError;
use App\Shipping\Carriers\JtCarrier;
use App\Shipping\Carriers\ShipmentDraft;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/** J&T Express Egypt (JMS open platform): signing from J&T's own SDK, shapes from its docs, against a faked HTTP layer. */
const JT_KEY = 'a0a1047cce70493c9d5d29704f05d0d9';

beforeEach(fn () => Cache::forget('shipping:jt:pca'));

function jtCredentials(array $override = []): array
{
    return $override + ['customer_code' => 'J0086024225', 'password' => 'secret-pass', 'api_account' => '292508153084379141', 'private_key' => JT_KEY];
}

function jtAccount(array $settings = []): CarrierAccount
{
    return new CarrierAccount(['carrier' => 'jt', 'credentials' => jtCredentials(), 'settings' => $settings + [
        'sender_name' => 'متجر حبة', 'sender_phone' => '01000000000', 'sender_governorate' => 'الجيزة',
        'sender_area' => 'الشيخ زايد|الشيخ زايد', 'sender_street' => 'شارع 1، الحي الأول', 'weight' => '1.5', 'goods_type' => 'ITN1', 'service_type' => '01',
    ]]);
}

/** J&T's online/pca list of places it delivers to (prov / city / area, Arabic). */
function jtPlaces(array $extra = []): void
{
    Http::fake($extra + [
        'openapi.jtjms-eg.com/webopenplatformapi/api/online/pca' => Http::response(['code' => '1', 'msg' => 'success', 'data' => [
            ['prov' => 'الجيزة', 'city' => 'مدينة السادس من أكتوبر', 'area' => 'الحي الأول'],
            ['prov' => 'الجيزة', 'city' => 'الشيخ زايد', 'area' => 'الشيخ زايد'],
            ['prov' => 'القاهرة', 'city' => 'مدينة نصر', 'area' => 'الحي السابع'],
            ['prov' => 'القاهرة', 'city' => 'مدينة نصر', 'area' => 'الحي العاشر'],
        ]]),
    ]);
}

/** The bizContent JSON of a sent request. */
function jtBiz(Request $request): array
{
    return (array) json_decode((string) $request['bizContent'], true);
}

it('signs every call as J&T\'s SDK does: the header digest and the customer digest', function () {
    jtPlaces(['openapi.jtjms-eg.com/webopenplatformapi/api/vip/checkCusPwd' => Http::response(['code' => '1', 'msg' => 'success'])]);

    $profile = (new JtCarrier)->verify(jtCredentials());

    expect($profile->accountName)->toBe('J0086024225')->and($profile->locations)->toBe([]);
    Http::assertSent(function (Request $r) {
        $biz = jtBiz($r);
        $cipher = strtoupper(md5('secret-pass'.'jadada236t2'));

        return str_ends_with($r->url(), '/vip/checkCusPwd')
            && $r->hasHeader('apiAccount', '292508153084379141')
            && $r->hasHeader('digest', base64_encode(md5((string) $r['bizContent'].JT_KEY, true)))
            && strlen((string) $r->header('timestamp')[0]) === 13
            && $biz['customerCode'] === 'J0086024225'
            && $biz['digest'] === base64_encode(md5('J0086024225'.$cipher.JT_KEY, true));
    });
});

it('takes a password J&T gave already hashed, and says when the account is wrong', function () {
    Http::fake(['*/vip/checkCusPwd' => Http::sequence()
        ->push(['code' => '1', 'msg' => 'success'])
        ->push(['code' => '145003050', 'msg' => 'customer password error'])]);
    $jt = new JtCarrier;

    $jt->verify(jtCredentials(['password' => 'E0D2B64E94CEB57733049598CB93AEB2']));
    Http::assertSent(fn (Request $r) => jtBiz($r)['digest'] === base64_encode(md5('J0086024225'.'E0D2B64E94CEB57733049598CB93AEB2'.JT_KEY, true)));

    try {
        $jt->verify(jtCredentials());
        $this->fail('expected an auth error');
    } catch (CarrierError $e) {
        expect($e->auth)->toBeTrue()->and($e->getMessage())->toBe((string) __('shipping.jt.auth'));
    }
});

it('lists a governorate\'s areas and matches the customer\'s city', function () {
    jtPlaces();
    $jt = new JtCarrier;

    expect($jt->districts(jtAccount(), 'القاهرة'))->toBe([
        ['id' => 'مدينة نصر|الحي السابع', 'name' => 'مدينة نصر - الحي السابع'],
        ['id' => 'مدينة نصر|الحي العاشر', 'name' => 'مدينة نصر - الحي العاشر'],
    ])
        ->and($jt->matchDistrict(jtAccount(), 'الجيزة', 'الحى الاول'))->toBe('مدينة السادس من أكتوبر|الحي الأول')
        // A city with one area only.
        ->and($jt->matchDistrict(jtAccount(), 'الجيزة', 'الشيخ زايد'))->toBe('الشيخ زايد|الشيخ زايد')
        // A city with several areas: the merchant picks.
        ->and($jt->matchDistrict(jtAccount(), 'القاهرة', 'مدينة نصر'))->toBeNull();
    expect(fn () => $jt->districts(jtAccount(), 'أسوان'))->toThrow(CarrierError::class, 'J&T مش بتوصّل لمحافظة أسوان.');
});

it('creates an order with the store\'s pickup address and the cash to collect', function () {
    jtPlaces(['*/order/addOrder' => Http::response(['code' => '1', 'msg' => 'success', 'data' => ['txlogisticId' => 'X', 'billCode' => 'UEG000000191681', 'sortingCode' => '20,J01-01,000']])]);
    $draft = new ShipmentDraft(
        reference: '7001', receiverName: 'سارة محمد', phone: '01011112222', phone2: null, email: null,
        governorate: 'القاهرة', city: 'مدينة نصر', address: 'شارع عباس العقاد 12', districtId: 'مدينة نصر|الحي العاشر', cod: 45050,
        itemsCount: 2, description: '2 × تيشيرت', notes: 'اتصل قبلها', allowOpen: false, images: [],
        locationId: null, packageType: 'Parcel', size: 'SMALL', webhookUrl: 'https://app.test/x', webhookSecret: 's',
    );

    $made = (new JtCarrier)->create(jtAccount(), $draft);

    expect($made->trackingNumber)->toBe('UEG000000191681')->and($made->externalId)->toBe('X')->and($made->update->state)->toBe(ShipmentState::Created);
    Http::assertSent(function (Request $r) {
        if (! str_ends_with($r->url(), '/order/addOrder')) {
            return false;
        }
        $biz = jtBiz($r);

        return $biz['expressType'] === 'EZ' && $biz['deliveryType'] === '04' && $biz['serviceType'] === '01' && $biz['operateType'] === 1
            && str_starts_with($biz['txlogisticId'], '7001-') && $biz['itemsValue'] === '450.50' && $biz['priceCurrency'] === 'EGP'
            && $biz['weight'] === '1.5' && $biz['goodsType'] === 'ITN1' && $biz['totalQuantity'] === '2'
            && $biz['receiver']['prov'] === 'القاهرة' && $biz['receiver']['city'] === 'مدينة نصر' && $biz['receiver']['area'] === 'الحي العاشر'
            && $biz['receiver']['mobile'] === '01011112222' && $biz['receiver']['countryCode'] === 'EGY'
            && $biz['sender']['name'] === 'متجر حبة' && $biz['sender']['prov'] === 'الجيزة' && $biz['sender']['area'] === 'الشيخ زايد';
    });
});

it('refuses to ship before the store\'s pickup address is filled', function () {
    jtPlaces();
    $draft = new ShipmentDraft('1', 'x', '0101', null, null, 'القاهرة', null, 'شارع طويل كفاية', 'مدينة نصر|الحي العاشر', 100, 1, 'x', null, false, [], null, 'Parcel', 'SMALL', 'u', 's');

    expect(fn () => (new JtCarrier)->create(jtAccount(['sender_street' => '']), $draft))->toThrow(CarrierError::class, (string) __('shipping.jt.sender_missing'));
});

it('tracks, cancels and prints (one PDF, or a ZIP for several)', function () {
    $pdf = "%PDF-1.4\nlabel\n%%EOF";
    Http::fake([
        '*/logistics/trace' => Http::response(['code' => '1', 'msg' => 'success', 'data' => [['billCode' => 'UEG1', 'details' => [
            ['scanTime' => '2026-11-22 12:26:25', 'scanType' => 'Signing scan', 'scanTypeCode' => '10'],
            ['scanTime' => '2026-11-22 09:00:00', 'scanType' => 'Pickup scan', 'scanTypeCode' => '1'],
        ]]]]),
        '*/order/cancelOrder' => Http::response(['code' => '1', 'msg' => 'success', 'data' => ['txlogisticId' => '7001-abc', 'billCode' => 'UEG1']]),
        '*/order/printOrder' => Http::response(['code' => '1', 'msg' => 'success', 'data' => ['billCode' => 'UEG1', 'base64EncodeContent' => base64_encode($pdf)]]),
    ]);
    $jt = new JtCarrier;

    $update = $jt->track(jtAccount(), 'UEG1');
    expect($update->state)->toBe(ShipmentState::Delivered)->and($update->code)->toBe(10)->and($update->at->toIso8601String())->toBe('2026-11-22T10:26:25+00:00');

    $jt->cancel(jtAccount(), 'UEG1', '7001-abc');
    Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/order/cancelOrder') && jtBiz($r)['txlogisticId'] === '7001-abc' && jtBiz($r)['orderType'] === '1');

    expect($jt->labels(jtAccount(), ['UEG1'], 'A6'))->toBe($pdf);
    Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/order/printOrder') && jtBiz($r)['printSize'] === 0);
    $zip = $jt->labels(jtAccount(), ['UEG1', 'UEG2'], 'A4');
    expect($zip)->toStartWith('PK');
});

it('checks J&T\'s signed status pushes and reads them', function () {
    $jt = new JtCarrier;
    $biz = json_encode(['billCode' => 'UEG1', 'txlogisticId' => '7001-abc', 'details' => [
        ['scanTime' => '2026-11-22 09:00:00', 'scanType' => 'Pickup scan', 'scanTypeCode' => '1'],
        ['scanTime' => '2026-11-22 15:00:00', 'scanType' => 'Return Scan', 'scanTypeCode' => '14'],
    ]], JSON_UNESCAPED_UNICODE);
    $signed = base64_encode(md5($biz.JT_KEY, true));

    expect($jt->webhookAuthentic(jtAccount(), ['digest' => $signed], ['bizContent' => $biz]))->toBeTrue()
        ->and($jt->webhookAuthentic(jtAccount(), ['digest' => 'forged'], ['bizContent' => $biz]))->toBeFalse()
        ->and($jt->webhook(['bizContent' => $biz])->state)->toBe(ShipmentState::Returning)
        ->and($jt->webhook(['bizContent' => json_encode(['billCode' => 'UEG1', 'scanType' => '已取消', 'reason' => 'x', 'time' => '2026-11-22 10:00:00'])])->state)->toBe(ShipmentState::Cancelled)
        ->and($jt->webhook(['bizContent' => 'nope']))->toBeNull()
        ->and(JtCarrier::state(null, 'Delivery scan'))->toBe(ShipmentState::OutForDelivery)
        ->and(JtCarrier::state(13, null))->toBe(ShipmentState::Returned)
        ->and(JtCarrier::state(11, null))->toBe(ShipmentState::Exception);
});
