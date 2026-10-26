<?php

declare(strict_types=1);

use App\Models\DiscountCode;
use App\Models\Offer;
use App\Models\Product;
use App\Models\ProductOption;
use Carbon\CarbonImmutable;

beforeEach(function () {
    $this->user = actingAsOwner();
    $this->product = asTenant($this->user, fn () => Product::factory()->withOption('المقاس', ['S' => '0', 'XL' => '25'])->create(['price' => '350.00']));
    $this->option = asTenant($this->user, fn () => ProductOption::query()->with('values')->firstOrFail());
    $this->travelTo(CarbonImmutable::parse('2026-11-10 12:00:00', 'UTC'));
});

function preview(array $overrides = [])
{
    $test = test();

    return $test->postJson('/api/v1/dashboard/pricing/preview', array_merge([
        'product_id' => $test->product->id,
        'quantity' => 2,
        'options' => [$test->option->id => $test->option->values->first()->id],
    ], $overrides));
}

it('returns a full quote', function () {
    preview()->assertOk()->assertJsonPath('data.base_subtotal', 700)->assertJsonPath('data.total', 700);
});

it('simulates a time inside and outside an offer window (Cairo time)', function () {
    asTenant($this->user, function () {
        $offer = Offer::factory()->bundle(2, '350.00')->create([
            'starts_at' => CarbonImmutable::parse('2026-11-11 00:00', 'Africa/Cairo')->utc(),
            'ends_at' => CarbonImmutable::parse('2026-11-12 00:00', 'Africa/Cairo')->utc(),
        ]);
        $offer->products()->attach($this->product->id, ['tenant_id' => $this->user->tenant_id]);
    });

    preview()->assertJsonPath('data.offer', null)->assertJsonPath('data.total', 700);
    preview(['at' => '2026-11-11T00:00'])->assertJsonPath('data.offer.type', 'bundle')->assertJsonPath('data.total', 350);
    preview(['at' => '2026-11-10T23:59'])->assertJsonPath('data.offer', null);
    preview(['at' => '2026-11-12T00:01'])->assertJsonPath('data.offer', null);
});

it('reports code problems without failing (200 + code_error)', function () {
    preview(['code' => 'NOPE'])->assertOk()->assertJsonPath('data.code_error', 'كود الخصم غير صحيح.')->assertJsonPath('data.total', 700);
});

it('applies EID25 with a 100 cap and a 3-use limit', function () {
    asTenant($this->user, fn () => DiscountCode::factory()->percentage(25, '100.00')->create(['code' => 'EID25', 'usage_limit' => 3]));

    // 25% of 700 = 175 → capped at 100
    preview(['code' => 'eid25'])->assertJsonPath('data.code.discount', 100)->assertJsonPath('data.total', 600);
    // 25% of 350 = 87.5 (under the cap)
    preview(['code' => 'EID25', 'quantity' => 1])->assertJsonPath('data.code.discount', 87.5);

    asTenant($this->user, fn () => DiscountCode::query()->where('code', 'EID25')->update(['used_count' => 3]));
    preview(['code' => 'EID25'])->assertJsonPath('data.code_error', 'تم استخدام كود الخصم بالكامل.');
});

it('returns 422 on option errors', function () {
    preview(['options' => []])->assertStatus(422)->assertJsonValidationErrors("options.{$this->option->id}");
    preview(['quantity' => 50])->assertStatus(422)->assertJsonValidationErrors('quantity');
});

it('rejects a product of another tenant', function () {
    $foreign = Product::factory()->create();

    preview(['product_id' => $foreign->id])->assertStatus(422)->assertJsonValidationErrors('product_id');
});
