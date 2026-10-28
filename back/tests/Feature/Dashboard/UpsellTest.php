<?php

declare(strict_types=1);

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Upsell;

beforeEach(function () {
    $this->user = actingAsOwner();
    [$this->main, $this->extra, $this->sized] = asTenant($this->user, fn () => [
        Product::factory()->create(['name' => 'ساعة']),
        Product::factory()->create(['name' => 'حزام', 'price' => '150.00']),
        Product::factory()->withOption('المقاس', ['S' => '0'])->create(['name' => 'تيشيرت']),
    ]);
});

function upsellPayload(array $overrides = []): array
{
    return array_merge(['name' => 'حزام مع الساعة', 'trigger_product_id' => test()->main->id, 'offer_product_id' => test()->extra->id, 'price' => 99, 'headline' => 'زوّد حزام بـ 99 بس'], $overrides);
}

it('creates, edits, toggles and deletes upsells', function () {
    $id = $this->postJson('/api/v1/dashboard/upsells', upsellPayload())->assertCreated()
        ->assertJsonPath('data.offer_product.name', 'حزام')
        ->assertJsonPath('data.price', 99)
        ->assertJsonPath('data.is_active', true)
        ->json('data.id');

    $this->putJson("/api/v1/dashboard/upsells/{$id}", upsellPayload(['price' => '89.5', 'trigger_product_id' => null]))->assertOk()->assertJsonPath('data.price', 89.5)->assertJsonPath('data.trigger_product', null);
    $this->postJson("/api/v1/dashboard/upsells/{$id}/toggle")->assertOk()->assertJsonPath('data.is_active', false);
    $this->deleteJson("/api/v1/dashboard/upsells/{$id}")->assertNoContent();
    expect(asTenant($this->user, fn () => Upsell::query()->count()))->toBe(0);
});

it('refuses products with required choices and offering the same product', function () {
    $this->postJson('/api/v1/dashboard/upsells', upsellPayload(['offer_product_id' => $this->sized->id]))->assertStatus(422)->assertJsonPath('errors.offer_product_id.0', __('orders.upsell_product_options'));
    $this->postJson('/api/v1/dashboard/upsells', upsellPayload(['offer_product_id' => $this->main->id]))->assertStatus(422)->assertJsonPath('errors.offer_product_id.0', __('orders.upsell_same_product'));
    $this->postJson('/api/v1/dashboard/upsells', ['price' => 0])->assertStatus(422)->assertJsonValidationErrors(['name', 'offer_product_id', 'price', 'headline']);
});

it('shows how often each upsell was accepted', function () {
    $id = $this->postJson('/api/v1/dashboard/upsells', upsellPayload())->json('data.id');
    asTenant($this->user, function () use ($id) {
        foreach ([1, 2] as $_) {
            $order = Order::factory()->create();
            OrderItem::query()->create(['order_id' => $order->id, 'product_id' => $this->extra->id, 'upsell_id' => $id, 'product_name' => 'حزام', 'unit_price' => '99.00', 'quantity' => 1, 'line_total' => '99.00']);
        }
    });

    $this->getJson('/api/v1/dashboard/upsells')->assertOk()->assertJsonPath('data.0.accepted_count', 2)->assertJsonPath('data.0.accepted_revenue', 198);
});

it('keeps upsells per store and needs a token', function () {
    $id = $this->postJson('/api/v1/dashboard/upsells', upsellPayload())->json('data.id');

    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/upsells')->assertOk()->assertJsonCount(0, 'data');
    $this->putJson("/api/v1/dashboard/upsells/{$id}", upsellPayload())->assertNotFound();
    $this->postJson('/api/v1/dashboard/upsells', upsellPayload())->assertStatus(422)->assertJsonValidationErrors(['offer_product_id', 'trigger_product_id']);

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/upsells')->assertUnauthorized();
});
