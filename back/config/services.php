<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    // WhatsApp Cloud API (Meta). Owner-approved; keys in .env only. Not configured = nothing is sent
    // (codes show on screen outside production). See App\Messaging\WhatsApp.
    'whatsapp' => [
        'token' => env('WHATSAPP_TOKEN'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'waba_id' => env('WHATSAPP_WABA_ID'),
        'app_secret' => env('WHATSAPP_APP_SECRET'),
        'verify_token' => env('WHATSAPP_VERIFY_TOKEN'),
        'graph_url' => env('WHATSAPP_GRAPH_URL', 'https://graph.facebook.com/v23.0'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // XPay (online payment of the platform's invoices: cards, wallets, Fawry, valU, Apple Pay). sk_test_* keys run in
    // XPay's test mode, sk_live_* take real money. driver "fake" swaps the API for FakeXPayClient (tests, e2e).
    'xpay' => [
        'driver' => env('XPAY_DRIVER', 'live'),
        'secret_key' => env('XPAY_SECRET_KEY'),
        'webhook_secret' => env('XPAY_WEBHOOK_SECRET'),
        'base_url' => env('XPAY_BASE_URL', 'https://api.xpay.app'),
        'timeout' => (int) env('XPAY_TIMEOUT', 20),
    ],

    // Pexels API v1 for stock photos in the AI designer (free; omitted from prompts when not configured).
    'pexels' => [
        'key' => env('PEXELS_API_KEY'),
    ],

];
