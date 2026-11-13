<?php

declare(strict_types=1);

use App\Jobs\RevalidateTenantHosts;
use Illuminate\Support\Facades\Queue;

it('saves the store pixels and the landing pages pixels, cleaned', function () {
    Queue::fake();
    $owner = actingAsOwner();

    $this->getJson('/api/v1/dashboard/pixels')->assertOk()
        ->assertJsonPath('data.store.meta_pixel_id', null)
        ->assertJsonPath('data.landing.conversion_event', 'Purchase')
        ->assertJsonPath('data.landing_same', false);

    $this->putJson('/api/v1/dashboard/pixels', [
        'store' => ['meta_pixel_id' => ' 1234567890 ', 'ga4_id' => 'g-abc123'],
        'landing' => ['tiktok_pixel_id' => 'abcdefghij12', 'conversion_event' => 'Lead'],
        'landing_same' => false,
    ])->assertOk()
        ->assertJsonPath('data.store.meta_pixel_id', '1234567890')
        ->assertJsonPath('data.store.ga4_id', 'G-ABC123')
        ->assertJsonPath('data.landing.tiktok_pixel_id', 'ABCDEFGHIJ12')
        ->assertJsonPath('data.landing.conversion_event', 'Lead');
    Queue::assertPushed(RevalidateTenantHosts::class, fn ($job) => $job->tenantId === $owner->tenant_id);

    $this->putJson('/api/v1/dashboard/pixels', ['store' => ['meta_pixel_id' => '"><script>'], 'landing' => [], 'landing_same' => 'x'])
        ->assertStatus(422)->assertJsonValidationErrors(['store.meta_pixel_id', 'landing_same']);
});

it('keeps each store to its own pixels and needs a sign-in', function () {
    $this->getJson('/api/v1/dashboard/pixels')->assertUnauthorized();

    $first = createOwner();
    $first->tenant->forceFill(['settings' => ['pixels' => ['store' => ['meta_pixel_id' => '1234567890'], 'landing' => [], 'landing_same' => true]]])->save();
    actingAsOwner();
    $this->getJson('/api/v1/dashboard/pixels')->assertOk()->assertJsonPath('data.store.meta_pixel_id', null);
});
