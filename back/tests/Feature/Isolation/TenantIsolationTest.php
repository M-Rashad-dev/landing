<?php

declare(strict_types=1);

use App\Models\DiscountCode;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Media;
use App\Models\Offer;
use App\Models\Product;
use App\Models\User;

/*
| Every tenant resource under /dashboard is listed here (add new ones each phase).
| A record of tenant A must be invisible to tenant B: 404 on item routes, absent from lists.
|
| Each entry: [create(User $owner): int id, list url, item requests [method, url-with-{id}, payload]]
*/
dataset('tenant resources', [
    'media' => [
        fn (User $owner) => asTenant($owner, fn () => Media::factory()->create())->id,
        '/api/v1/dashboard/media',
        [
            ['PATCH', '/api/v1/dashboard/media/{id}', ['alt' => 'x']],
            ['DELETE', '/api/v1/dashboard/media/{id}', []],
        ],
    ],
    'identities' => [
        fn (User $owner) => asTenant($owner, fn () => Identity::factory()->create())->id,
        '/api/v1/dashboard/identities',
        [
            ['GET', '/api/v1/dashboard/identities/{id}', []],
            ['PUT', '/api/v1/dashboard/identities/{id}', ['name' => 'x']],
            ['DELETE', '/api/v1/dashboard/identities/{id}', []],
            ['POST', '/api/v1/dashboard/identities/{id}/make-default', []],
        ],
    ],
    'products' => [
        fn (User $owner) => asTenant($owner, fn () => Product::factory()->create())->id,
        '/api/v1/dashboard/products',
        [
            ['GET', '/api/v1/dashboard/products/{id}', []],
            ['PUT', '/api/v1/dashboard/products/{id}', ['name' => 'x', 'price' => '10']],
            ['DELETE', '/api/v1/dashboard/products/{id}', []],
            ['POST', '/api/v1/dashboard/products/{id}/toggle', []],
            ['POST', '/api/v1/dashboard/products/{id}/duplicate', []],
        ],
    ],
    'offers' => [
        fn (User $owner) => asTenant($owner, fn () => Offer::factory()->create())->id,
        '/api/v1/dashboard/offers',
        [
            ['GET', '/api/v1/dashboard/offers/{id}', []],
            ['PUT', '/api/v1/dashboard/offers/{id}', ['name' => 'x', 'type' => 'percentage', 'value' => 10, 'product_ids' => [1]]],
            ['DELETE', '/api/v1/dashboard/offers/{id}', []],
            ['POST', '/api/v1/dashboard/offers/{id}/toggle', []],
        ],
    ],
    'discount codes' => [
        fn (User $owner) => asTenant($owner, fn () => DiscountCode::factory()->create())->id,
        '/api/v1/dashboard/discount-codes',
        [
            ['GET', '/api/v1/dashboard/discount-codes/{id}', []],
            ['PUT', '/api/v1/dashboard/discount-codes/{id}', ['code' => 'XYZ', 'type' => 'fixed', 'value' => '5']],
            ['DELETE', '/api/v1/dashboard/discount-codes/{id}', []],
            ['POST', '/api/v1/dashboard/discount-codes/{id}/toggle', []],
            ['GET', '/api/v1/dashboard/discount-codes/{id}/redemptions', []],
        ],
    ],
    'pages' => [
        fn (User $owner) => asTenant($owner, fn () => LandingPage::factory()->create())->id,
        '/api/v1/dashboard/pages',
        [
            ['GET', '/api/v1/dashboard/pages/{id}', []],
            ['PUT', '/api/v1/dashboard/pages/{id}', ['title' => 'x', 'slug' => 'xx', 'identity_id' => 1]],
            ['PUT', '/api/v1/dashboard/pages/{id}/content', ['version' => 1, 'content' => ['version' => 1, 'sections' => []]]],
            ['GET', '/api/v1/dashboard/pages/{id}/preview', []],
            ['POST', '/api/v1/dashboard/pages/{id}/publish', []],
            ['POST', '/api/v1/dashboard/pages/{id}/unpublish', []],
            ['POST', '/api/v1/dashboard/pages/{id}/duplicate', []],
            ['POST', '/api/v1/dashboard/pages/{id}/set-home', []],
            ['DELETE', '/api/v1/dashboard/pages/{id}', []],
        ],
    ],
]);

it('hides tenant A records from tenant B', function (Closure $create, string $listUrl, array $itemRequests) {
    $ownerA = createOwner();
    $ownerB = createOwner();
    $id = $create($ownerA);

    actingAsOwner($ownerB);

    $listed = collect($this->getJson($listUrl)->assertOk()->json('data'))->pluck('id');
    expect($listed)->not->toContain($id);

    foreach ($itemRequests as [$method, $url, $payload]) {
        $this->json($method, str_replace('{id}', (string) $id, $url), $payload)
            ->assertNotFound()
            ->assertJsonPath('code', 'not_found');
    }

    // Tenant A still sees its record.
    actingAsOwner($ownerA);
    expect(collect($this->getJson($listUrl)->json('data'))->pluck('id'))->toContain($id);
})->with('tenant resources');

it('requires a token for every tenant resource', function (Closure $create, string $listUrl, array $itemRequests) {
    $this->getJson($listUrl)->assertUnauthorized();

    foreach ($itemRequests as [$method, $url, $payload]) {
        $this->json($method, str_replace('{id}', '1', $url), $payload)->assertUnauthorized();
    }
})->with('tenant resources');
