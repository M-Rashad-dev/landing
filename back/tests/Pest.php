<?php

declare(strict_types=1);

use App\Billing\Themes\ThemeAccess;
use App\Models\Domain;
use App\Models\Tenant;
use App\Models\User;
use App\Tenancy\Tenancy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)->in('Unit');

/**
 * A tenant with its owner and active primary subdomain.
 */
function createOwner(array $userAttributes = []): User
{
    $tenant = Tenant::factory()->create();
    $user = User::factory()->for($tenant)->create($userAttributes);
    Domain::factory()->for($tenant)->create();

    return $user->fresh(['tenant']);
}

function actingAsOwner(?User $user = null): User
{
    $user ??= createOwner();
    Sanctum::actingAs($user);

    return $user;
}

/** Run a callback inside the user's tenant context (for creating fixtures). */
function asTenant(User|Tenant|int $tenant, Closure $callback): mixed
{
    $id = match (true) {
        $tenant instanceof User => (int) $tenant->tenant_id,
        $tenant instanceof Tenant => $tenant->id,
        default => $tenant,
    };

    return Tenancy::runAs($id, $callback);
}

function internalHeaders(): array
{
    return ['X-Internal-Key' => 'test-internal-key', 'Accept' => 'application/json'];
}

/** The store owns these paid themes (as if bought). */
function ownThemes(User|Tenant $tenant, string ...$keys): void
{
    $model = $tenant instanceof User ? $tenant->tenant : $tenant;
    foreach ($keys as $key) {
        app(ThemeAccess::class)->grant($model, $key, 'admin_grant', null, 0);
    }
}
