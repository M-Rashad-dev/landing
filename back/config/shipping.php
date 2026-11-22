<?php

declare(strict_types=1);

use App\Shipping\Carriers\BostaCarrier;
use App\Shipping\Carriers\JtCarrier;

return [
    // live = the carriers' real APIs; fake = FakeCarrier for every key (tests, e2e, a dev box without accounts).
    'driver' => env('SHIPPING_CARRIERS_DRIVER', 'live'),

    // The carriers a store can connect, in the order they are offered. A new carrier = one class + one line.
    'carriers' => [
        'bosta' => BostaCarrier::class,
        'jt' => JtCarrier::class,
    ],

    'bosta' => [
        'base_url' => env('BOSTA_BASE_URL', 'https://app.bosta.co/api/v2'),
        'timeout' => (int) env('BOSTA_TIMEOUT', 20),
    ],

    // J&T Express Egypt (JMS open platform); its test server: https://demoopenapi.jtjms-eg.com/webopenplatformapi/api
    'jt' => [
        'base_url' => env('JT_BASE_URL', 'https://openapi.jtjms-eg.com/webopenplatformapi/api'),
        'timeout' => (int) env('JT_TIMEOUT', 20),
    ],

    // Open shipments are asked again this often when no webhook came (minutes).
    'sync_after_minutes' => 120,
];
