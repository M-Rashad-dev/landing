<?php

declare(strict_types=1);

use App\Store\Payments\Gateways\KashierGateway;
use App\Store\Payments\Gateways\PaymobGateway;
use App\Store\Payments\Gateways\XPayStoreGateway;

/*
 * Online payment gateways a store connects with its own account (the money goes to the merchant, never through the
 * platform). One class per gateway (App\Store\Payments\Gateways\StoreGateway). driver "fake" swaps every gateway for
 * FakeStoreGateway (tests, e2e, a dev box without accounts).
 */
return [
    'driver' => env('STORE_GATEWAYS_DRIVER', 'live'),

    'gateways' => [
        'paymob' => PaymobGateway::class,
        'kashier' => KashierGateway::class,
        'xpay' => XPayStoreGateway::class,
    ],

    'timeout' => (int) env('STORE_GATEWAYS_TIMEOUT', 20),
];
