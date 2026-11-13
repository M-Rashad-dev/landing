<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\Identity;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;

function pagesOwner(string $host = 'pages-shop.localhost', string $plan = 'pro'): Tenant
{
    $tenant = Tenant::factory()->onPlan($plan)->create();
    Domain::factory()->for($tenant)->create(['host' => $host, 'active_host' => $host]);
    asTenant($tenant, fn () => Identity::factory()->default()->create());
    Sanctum::actingAs(User::factory()->for($tenant)->create()->fresh(['tenant']));

    return $tenant;
}

it('writes, orders, hides and serves the store pages', function () {
    pagesOwner();
    $this->postJson('/api/v1/dashboard/store/setup')->assertOk();
    $this->postJson('/api/v1/dashboard/store/design/publish')->assertOk();
    $this->putJson('/api/v1/dashboard/store', ['is_enabled' => true])->assertOk();

    $about = $this->postJson('/api/v1/dashboard/store-pages', ['title' => 'من نحن', 'body' => '## قصتنا'])->assertCreated()->assertJsonPath('data.slug', 'من-نحن')->assertJsonPath('data.position', 1)->json('data.id');
    $privacy = $this->postJson('/api/v1/dashboard/store-pages', ['title' => 'سياسة الخصوصية', 'slug' => 'privacy', 'body' => 'بياناتك آمنة', 'seo' => ['title' => 'الخصوصية', 'description' => '']])
        ->assertCreated()->assertJsonPath('data.position', 2)->assertJsonPath('data.seo', ['title' => 'الخصوصية'])->json('data.id');

    $this->putJson('/api/v1/dashboard/store-pages/order', ['ids' => [$privacy, $about]])->assertNoContent();
    $this->getJson('/api/v1/dashboard/store-pages')->assertOk()->assertJsonPath('data.0.slug', 'privacy')->assertJsonPath('data.1.slug', 'من-نحن');

    $host = ['host' => 'pages-shop.localhost'];
    $this->getJson('/api/v1/public/store?'.http_build_query($host), internalHeaders())->assertJsonPath('data.pages.0.slug', 'privacy');
    $this->getJson('/api/v1/public/store/pages/privacy?'.http_build_query($host), internalHeaders())->assertOk()->assertJsonPath('data.body', 'بياناتك آمنة');

    // Hidden: off the footer and the store, still in the dashboard.
    $this->putJson("/api/v1/dashboard/store-pages/{$privacy}", ['title' => 'سياسة الخصوصية', 'body' => 'بياناتك آمنة', 'is_published' => false])->assertOk()->assertJsonPath('data.is_published', false);
    $this->getJson('/api/v1/public/store/pages/privacy?'.http_build_query($host), internalHeaders())->assertNotFound();
    $this->getJson('/api/v1/public/store?'.http_build_query($host), internalHeaders())->assertJsonCount(1, 'data.pages');

    $this->deleteJson("/api/v1/dashboard/store-pages/{$about}")->assertNoContent();
    $this->getJson('/api/v1/dashboard/store-pages')->assertJsonCount(1, 'data');
});

it('validates titles, slugs and the order', function () {
    pagesOwner();
    $this->postJson('/api/v1/dashboard/store-pages', ['title' => '', 'slug' => 'Bad Slug!'])->assertStatus(422)->assertJsonValidationErrors(['title', 'slug']);
    $this->postJson('/api/v1/dashboard/store-pages', ['title' => 'الشحن', 'slug' => 'shipping'])->assertCreated();
    $this->postJson('/api/v1/dashboard/store-pages', ['title' => 'الشحن 2', 'slug' => 'shipping'])->assertStatus(422)->assertJsonValidationErrors('slug');
    $this->putJson('/api/v1/dashboard/store-pages/order', ['ids' => [999999]])->assertStatus(422)->assertJsonValidationErrors('ids.0');
});

it('keeps pages to their store and needs a token', function () {
    pagesOwner();
    $page = $this->postJson('/api/v1/dashboard/store-pages', ['title' => 'من نحن'])->json('data.id');

    pagesOwner('other-pages.localhost');
    $this->putJson("/api/v1/dashboard/store-pages/{$page}", ['title' => 'x'])->assertNotFound();
    $this->putJson('/api/v1/dashboard/store-pages/order', ['ids' => [$page]])->assertStatus(422);
    // Same slug is fine in another store.
    $this->postJson('/api/v1/dashboard/store-pages', ['title' => 'من نحن'])->assertCreated()->assertJsonPath('data.slug', 'من-نحن');

    app('auth')->forgetGuards();
    $this->withHeaders(['Authorization' => ''])->getJson('/api/v1/dashboard/store-pages')->assertUnauthorized();
});
