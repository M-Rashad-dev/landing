<?php

declare(strict_types=1);

use App\Enums\DomainStatus;
use App\Jobs\RevalidateTenantHosts;
use App\Models\Domain;
use App\Models\Identity;
use App\Services\FrontendRevalidator;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;

it('posts the active host tags to Next with the shared secret', function () {
    config(['landing.front_internal_url' => 'http://front:3000']);
    Http::fake(['front:3000/*' => Http::response(['revalidated' => 2])]);

    $owner = createOwner();
    asTenant($owner, fn () => Domain::factory()->custom('shop.example.com', DomainStatus::Active)->create());
    asTenant($owner, fn () => Domain::factory()->custom('pending.example.com')->create());

    (new RevalidateTenantHosts($owner->tenant_id, ['old-name.platform.test']))->handle(app(FrontendRevalidator::class));

    Http::assertSent(function ($request) {
        $tags = $request['tags'];
        sort($tags);

        return $request->url() === 'http://front:3000/api/revalidate'
            && $request->header('X-Revalidate-Secret')[0] === 'test-revalidate-secret'
            && count($tags) === 3
            && in_array('host:shop.example.com', $tags, true)
            && in_array('host:old-name.platform.test', $tags, true)
            && ! in_array('host:pending.example.com', $tags, true);
    });
});

it('logs a warning and skips when Next is not configured', function () {
    config(['landing.front_internal_url' => '']);
    Http::fake();
    Log::spy();

    $owner = createOwner();
    (new RevalidateTenantHosts($owner->tenant_id))->handle(app(FrontendRevalidator::class));

    Http::assertNothingSent();
    Log::shouldHaveReceived('warning')->once();
});

it('throws so the queue retries when Next fails', function () {
    config(['landing.front_internal_url' => 'http://front:3000']);
    Http::fake(['front:3000/*' => Http::response([], 500)]);

    $owner = createOwner();
    (new RevalidateTenantHosts($owner->tenant_id))->handle(app(FrontendRevalidator::class));
})->throws(RuntimeException::class);

it('is dispatched after an identity changes', function () {
    Queue::fake();
    $owner = actingAsOwner();
    $identity = asTenant($owner, fn () => Identity::factory()->default()->create());

    $this->putJson("/api/v1/dashboard/identities/{$identity->id}", [
        'name' => 'x', 'brand_name' => 'y', 'font_heading' => 'cairo', 'font_body' => 'cairo', 'button_radius' => 'md',
        'colors' => config('landing.default_colors'),
    ])->assertOk();

    Queue::assertPushed(RevalidateTenantHosts::class, fn ($job) => $job->tenantId === $owner->tenant_id);
});
