<?php

declare(strict_types=1);

use App\Services\FormToken;
use Database\Seeders\ThemeSeeder;

/*
| PLAN phase 11 (C.1): one store from sign-up to CSV export, only through the HTTP API.
| register → identity → product with options → offer + code → page → publish → resolve
| → quote → order → status changes → export.
*/

it('runs the whole store flow through the API', function () {
    $this->seed(ThemeSeeder::class);

    // Register: tenant + owner + active primary subdomain + token.
    $register = $this->postJson('/api/v1/auth/register', [
        'name' => 'محمد رشاد',
        'email' => 'flow@example.com',
        'phone' => '01012345699',
        'store_name' => 'Flow Store',
        'password' => 'secret-pass-1',
        'password_confirmation' => 'secret-pass-1',
    ])->assertCreated();
    $host = $register->json('data.domain.host');
    $auth = ['Authorization' => 'Bearer '.$register->json('data.token'), 'Accept' => 'application/json'];

    // Identity (becomes the page identity) with a Meta pixel.
    $identity = $this->postJson('/api/v1/dashboard/identities', [
        'name' => 'هوية العرض',
        'brand_name' => 'Flow Brand',
        'colors' => ['primary' => '#0EA5E9', 'secondary' => '#F0F9FF', 'accent' => '#F59E0B', 'background' => '#FFFFFF', 'foreground' => '#0F172A', 'muted' => '#64748B', 'border' => '#E2E8F0'],
        'font_heading' => 'cairo',
        'font_body' => 'cairo',
        'button_radius' => 'lg',
        'tracking' => ['meta_pixel_id' => '123456789012345', 'conversion_event' => 'Purchase'],
    ], $auth)->assertCreated()->json('data');

    // Product with a priced option.
    $product = $this->postJson('/api/v1/dashboard/products', [
        'name' => 'شنطة جلد',
        'price' => '400',
        'options' => [['name' => 'اللون', 'display_type' => 'buttons', 'is_required' => true, 'values' => [
            ['label' => 'بني', 'price_delta' => '0'],
            ['label' => 'أسود', 'price_delta' => '25'],
        ]]],
    ], $auth)->assertCreated()->json('data');
    $optionId = $product['options'][0]['id'];
    $black = $product['options'][0]['values'][1]['id'];

    // Offer: 10% off; code: 50 EGP fixed, stackable.
    $this->postJson('/api/v1/dashboard/offers', ['name' => 'خصم الافتتاح', 'type' => 'percentage', 'value' => 10, 'product_ids' => [$product['id']]], $auth)->assertCreated();
    $this->postJson('/api/v1/dashboard/discount-codes', ['code' => 'FLOW50', 'type' => 'fixed', 'value' => '50', 'stackable_with_offers' => true], $auth)->assertCreated();

    // Page → publish → home.
    $page = $this->postJson('/api/v1/dashboard/pages', [
        'title' => 'صفحة الشنطة',
        'slug' => 'bag',
        'theme_key' => 'bidaya',
        'identity_id' => $identity['id'],
        'product_id' => $product['id'],
        // No content: the page starts with «بداية»'s sections and its order form.
    ], $auth)->assertCreated()->json('data');
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/publish", [], $auth)->assertOk();
    $this->postJson("/api/v1/dashboard/pages/{$page['id']}/set-home", [], $auth)->assertOk();

    // Public side: resolve the host, read the page.
    $internal = internalHeaders();
    $this->getJson("/api/v1/public/resolve-host?host={$host}", $internal)->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.home_slug', 'bag');
    $this->getJson("/api/v1/public/pages?host={$host}&slug=", $internal)
        ->assertOk()
        ->assertJsonPath('data.theme_key', 'bidaya')
        ->assertJsonPath('data.tracking.meta_pixel_id', '123456789012345');

    // Quote: 2 × (400 + 25) = 850, offer −85 = 765, code −50 = 715.
    $quote = $this->postJson('/api/v1/public/quote', ['host' => $host, 'slug' => 'bag', 'quantity' => 2, 'options' => [$optionId => $black], 'code' => 'flow50'], $internal)->assertOk();
    $quote->assertJsonPath('data.base_subtotal', 850)->assertJsonPath('data.offer.discount', 85)->assertJsonPath('data.code.discount', 50)->assertJsonPath('data.total', 715);

    // Order with the same numbers.
    $order = $this->postJson('/api/v1/public/orders', [
        'host' => $host,
        'slug' => 'bag',
        'quantity' => 2,
        'options' => [$optionId => $black],
        'code' => 'FLOW50',
        'customer' => ['name' => 'عميل', 'phone' => '01155554444', 'governorate' => 'الجيزة', 'address' => 'الهرم'],
        'answers' => [],
        'form_token' => app(FormToken::class)->issue($page['id'], time() - 10),
        'website' => '',
        'ip' => '41.10.20.30',
    ], $internal)->assertCreated();
    $order->assertJsonPath('data.order_number', 1001)->assertJsonPath('data.total', 715);

    // Dashboard: list, details, status chain.
    $list = $this->getJson('/api/v1/dashboard/orders', $auth)->assertOk();
    $orderId = $list->json('data.0.id');
    $this->getJson("/api/v1/dashboard/orders/{$orderId}", $auth)
        ->assertJsonPath('data.items.0.options.0.value', 'أسود')
        ->assertJsonPath('data.code.code', 'FLOW50');
    foreach (['confirmed', 'delivered'] as $status) {
        $this->postJson("/api/v1/dashboard/orders/{$orderId}/status", ['status' => $status], $auth)->assertOk()->assertJsonPath('data.status', $status);
    }
    $this->getJson('/api/v1/dashboard/overview', $auth)->assertOk()->assertJsonPath('data.revenue_delivered', 715);

    // Export.
    $csv = $this->get('/api/v1/dashboard/orders/export', $auth)->assertOk()->streamedContent();
    expect($csv)->toStartWith("\u{FEFF}")->toContain('1001')->toContain('715');
});
