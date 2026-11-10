<?php

declare(strict_types=1);

use App\Models\Offer;
use App\Models\Product;
use Carbon\CarbonImmutable;

beforeEach(function () {
    $this->user = actingAsOwner();
    $this->product = asTenant($this->user, fn () => Product::factory()->create(['price' => '350.00']));
});

function offerPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'اشتري 2 بـ 600',
        'type' => 'bundle',
        'bundle_quantity' => 2,
        'bundle_price' => '600',
        'starts_at' => null,
        'ends_at' => null,
        'is_active' => true,
        'badge_text' => 'وفّر 100',
        'priority' => 0,
        'product_ids' => [test()->product->id],
    ], $overrides);
}

it('creates a bundle offer with products', function () {
    $this->postJson('/api/v1/dashboard/offers', offerPayload())
        ->assertCreated()
        ->assertJsonPath('data.type', 'bundle')
        ->assertJsonPath('data.bundle_quantity', 2)
        ->assertJsonPath('data.bundle_price', 600)
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.product_ids', [$this->product->id]);
});

it('stores Cairo local times as UTC', function () {
    $response = $this->postJson('/api/v1/dashboard/offers', offerPayload([
        'starts_at' => '2026-11-01T10:00',
        'ends_at' => '2026-11-02T10:00',
    ]))->assertCreated();

    // Cairo is UTC+2 in November.
    expect($response->json('data.starts_at'))->toBe('2026-11-01T08:00:00Z')
        ->and($response->json('data.ends_at'))->toBe('2026-11-02T08:00:00Z');
});

it('validates offer values per type', function (array $override, string $field) {
    $this->postJson('/api/v1/dashboard/offers', offerPayload($override))->assertStatus(422)->assertJsonValidationErrors($field);
})->with([
    'percentage 100' => [['type' => 'percentage', 'value' => 100], 'value'],
    'percentage 0' => [['type' => 'percentage', 'value' => 0], 'value'],
    'fixed above price' => [['type' => 'fixed', 'value' => '350'], 'value'],
    'fixed zero' => [['type' => 'fixed', 'value' => '0'], 'value'],
    'bundle not profitable' => [['bundle_price' => '700'], 'bundle_price'],
    'bundle quantity 1' => [['bundle_quantity' => 1], 'bundle_quantity'],
    'end before start' => [['starts_at' => '2026-11-02T10:00', 'ends_at' => '2026-11-01T10:00'], 'ends_at'],
    'no products' => [['product_ids' => []], 'product_ids'],
    'bad date' => [['starts_at' => 'tomorrow'], 'starts_at'],
]);

it('rejects products of another tenant', function () {
    $foreign = Product::factory()->create();

    $this->postJson('/api/v1/dashboard/offers', offerPayload(['product_ids' => [$foreign->id]]))
        ->assertStatus(422)->assertJsonValidationErrors('product_ids.0');
});

it('computes the status from the time window', function () {
    $this->travelTo(CarbonImmutable::parse('2026-11-10 12:00:00', 'UTC'));
    asTenant($this->user, function () {
        Offer::factory()->create(['name' => 'off', 'is_active' => false]);
        Offer::factory()->create(['name' => 'future', 'starts_at' => now()->addDay()]);
        Offer::factory()->create(['name' => 'past', 'ends_at' => now()->subDay()]);
        Offer::factory()->create(['name' => 'now', 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay()]);
    });

    $statuses = collect($this->getJson('/api/v1/dashboard/offers')->json('data'))->pluck('status', 'name')->all();
    expect($statuses)->toBe(['now' => 'active', 'past' => 'expired', 'future' => 'scheduled', 'off' => 'inactive']);

    foreach (['active' => 'now', 'expired' => 'past', 'scheduled' => 'future', 'inactive' => 'off'] as $status => $name) {
        $this->getJson("/api/v1/dashboard/offers?status={$status}")->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', $name);
    }
});

it('updates, toggles and deletes an offer', function () {
    $id = $this->postJson('/api/v1/dashboard/offers', offerPayload())->json('data.id');

    $this->putJson("/api/v1/dashboard/offers/{$id}", offerPayload(['type' => 'percentage', 'value' => 15]))
        ->assertOk()->assertJsonPath('data.value', 15);
    $this->postJson("/api/v1/dashboard/offers/{$id}/toggle")->assertJsonPath('data.status', 'inactive');
    $this->deleteJson("/api/v1/dashboard/offers/{$id}")->assertNoContent();
    $this->getJson("/api/v1/dashboard/offers/{$id}")->assertNotFound();
});

it('enforces the offers limit', function () {
    config(['landing.limits.offers' => 1]);
    $this->postJson('/api/v1/dashboard/offers', offerPayload())->assertCreated();
    $this->postJson('/api/v1/dashboard/offers', offerPayload())->assertStatus(403)->assertJsonPath('code', 'plan_limit_reached');
});

it('unlinks offers when a product is deleted', function () {
    $id = $this->postJson('/api/v1/dashboard/offers', offerPayload())->json('data.id');

    $this->deleteJson("/api/v1/dashboard/products/{$this->product->id}")->assertNoContent();

    $this->getJson("/api/v1/dashboard/offers/{$id}")->assertJsonPath('data.product_ids', []);
});
