<?php

declare(strict_types=1);

use App\Models\Identity;
use App\Models\Media;
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
