<?php

declare(strict_types=1);

use App\Jobs\RevalidateTenantHosts;
use App\Models\ShippingRate;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->user = actingAsOwner();
});

it('starts with shipping off and every governorate at the default fee', function () {
    $response = $this->getJson('/api/v1/dashboard/shipping')->assertOk()->assertJsonPath('data.enabled', false)->assertJsonPath('data.default_fee', 0);
    expect($response->json('data.rates'))->toHaveCount(count(config('landing.governorates')))
        ->and($response->json('data.rates.0'))->toBe(['governorate' => config('landing.governorates')[0], 'fee' => null, 'is_available' => true]);
});

it('saves fees, keeps only rows that differ from the default and revalidates the site', function () {
    Queue::fake();
    $this->putJson('/api/v1/dashboard/shipping', [
        'enabled' => true,
        'default_fee' => '45',
        'free_over' => 1500,
        'rates' => [
            ['governorate' => 'أسوان', 'fee' => 80, 'is_available' => true],
            ['governorate' => 'شمال سيناء', 'fee' => null, 'is_available' => false],
            ['governorate' => 'القاهرة', 'fee' => null, 'is_available' => true],
        ],
    ])->assertOk()
        ->assertJsonPath('data.enabled', true)
        ->assertJsonPath('data.default_fee', 45)
        ->assertJsonPath('data.free_over', 1500);

    expect(asTenant($this->user, fn () => ShippingRate::query()->pluck('governorate')->sort()->values()->all()))->toBe(['أسوان', 'شمال سيناء']);
    Queue::assertPushed(RevalidateTenantHosts::class);

    // Back to the default removes the row.
    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true, 'default_fee' => 45, 'free_over' => null, 'rates' => [['governorate' => 'أسوان', 'fee' => null, 'is_available' => true]]])->assertOk();
    expect(asTenant($this->user, fn () => ShippingRate::query()->count()))->toBe(1);
});

it('validates the shipping settings', function () {
    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true, 'default_fee' => -1, 'rates' => [['governorate' => 'باريس', 'fee' => 'x', 'is_available' => 'maybe']]])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['default_fee', 'rates.0.governorate', 'rates.0.fee', 'rates.0.is_available']);
});

it('keeps each store’s shipping apart and needs a token', function () {
    $this->putJson('/api/v1/dashboard/shipping', ['enabled' => true, 'default_fee' => 60, 'free_over' => null, 'rates' => []])->assertOk();

    actingAsOwner(createOwner());
    $this->getJson('/api/v1/dashboard/shipping')->assertJsonPath('data.enabled', false)->assertJsonPath('data.default_fee', 0);

    app('auth')->forgetGuards();
    $this->getJson('/api/v1/dashboard/shipping')->assertUnauthorized();
    $this->putJson('/api/v1/dashboard/shipping', [])->assertUnauthorized();
});
