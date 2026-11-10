<?php

declare(strict_types=1);

use App\Models\DiscountCode;
use App\Models\DiscountCodeRedemption;
use App\Models\Order;
use App\Models\Product;

beforeEach(function () {
    $this->user = actingAsOwner();
    $this->product = asTenant($this->user, fn () => Product::factory()->create(['price' => '350.00']));
});

function codePayload(array $overrides = []): array
{
    return array_merge([
        'code' => 'eid25',
        'type' => 'percentage',
        'value' => 25,
        'max_discount' => '100',
        'min_order_total' => null,
        'starts_at' => null,
        'ends_at' => null,
        'usage_limit' => 3,
        'usage_limit_per_phone' => 1,
        'stackable_with_offers' => true,
        'is_active' => true,
        'product_ids' => [],
    ], $overrides);
}

it('creates a code stored uppercase', function () {
    $this->postJson('/api/v1/dashboard/discount-codes', codePayload(['code' => ' eid 25 ']))
        ->assertCreated()
        ->assertJsonPath('data.code', 'EID25')
        ->assertJsonPath('data.value', 25)
        ->assertJsonPath('data.max_discount', 100)
        ->assertJsonPath('data.remaining', 3)
        ->assertJsonPath('data.status', 'active');
});

it('rejects a duplicate code in any letter case', function () {
    $this->postJson('/api/v1/dashboard/discount-codes', codePayload())->assertCreated();

    $this->postJson('/api/v1/dashboard/discount-codes', codePayload(['code' => 'Eid25']))
        ->assertStatus(422)->assertJsonValidationErrors('code');
});

it('allows the same code in another tenant', function () {
    asTenant(createOwner(), fn () => DiscountCode::factory()->create(['code' => 'EID25']));

    $this->postJson('/api/v1/dashboard/discount-codes', codePayload())->assertCreated();
});

it('validates code format and values', function (array $override, string $field) {
    $this->postJson('/api/v1/dashboard/discount-codes', codePayload($override))->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'too short' => [['code' => 'AB'], 'code'],
    'bad chars' => [['code' => 'EID 25!'], 'code'],
    'percentage over 100' => [['value' => 101], 'value'],
    'fixed zero' => [['type' => 'fixed', 'value' => '0'], 'value'],
    'end before start' => [['starts_at' => '2026-11-02T10:00', 'ends_at' => '2026-11-01T10:00'], 'ends_at'],
    'usage limit 0' => [['usage_limit' => 0], 'usage_limit'],
    'foreign product' => [['product_ids' => [999999]], 'product_ids.0'],
]);

it('frees the code value when a code is deleted', function () {
    $id = $this->postJson('/api/v1/dashboard/discount-codes', codePayload())->json('data.id');
    $this->deleteJson("/api/v1/dashboard/discount-codes/{$id}")->assertNoContent();

    $this->postJson('/api/v1/dashboard/discount-codes', codePayload())->assertCreated();
});

it('locks the type after the first use', function () {
    $code = asTenant($this->user, fn () => DiscountCode::factory()->create(['code' => 'USED']));
    asTenant($this->user, fn () => DiscountCodeRedemption::create(['discount_code_id' => $code->id, 'order_id' => Order::factory()->create()->id, 'phone' => '+201012345678', 'amount' => '5.00']));

    $this->putJson("/api/v1/dashboard/discount-codes/{$code->id}", codePayload(['code' => 'USED', 'type' => 'fixed', 'value' => '50']))
        ->assertStatus(422)->assertJsonValidationErrors('type');

    $this->putJson("/api/v1/dashboard/discount-codes/{$code->id}", codePayload(['code' => 'USED', 'value' => 30]))->assertOk();
});

it('lists redemptions and filters codes', function () {
    $code = asTenant($this->user, fn () => DiscountCode::factory()->create(['code' => 'SUMMER']));
    asTenant($this->user, fn () => DiscountCodeRedemption::create(['discount_code_id' => $code->id, 'order_id' => Order::factory()->create()->id, 'phone' => '+201012345678', 'amount' => '25.50']));

    $this->getJson("/api/v1/dashboard/discount-codes/{$code->id}/redemptions")
        ->assertOk()
        ->assertJsonPath('data.0.amount', 25.5)
        ->assertJsonPath('data.0.phone', '+201012345678');

    $this->getJson('/api/v1/dashboard/discount-codes?q=summ')->assertJsonCount(1, 'data');
    $this->postJson("/api/v1/dashboard/discount-codes/{$code->id}/toggle")->assertJsonPath('data.status', 'inactive');
    $this->getJson('/api/v1/dashboard/discount-codes?status=inactive')->assertJsonCount(1, 'data');
});

it('enforces the codes limit', function () {
    config(['landing.limits.discount_codes' => 1]);
    $this->postJson('/api/v1/dashboard/discount-codes', codePayload())->assertCreated();
    $this->postJson('/api/v1/dashboard/discount-codes', codePayload(['code' => 'OTHER']))->assertStatus(403)->assertJsonPath('code', 'plan_limit_reached');
});
