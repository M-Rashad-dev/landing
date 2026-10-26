<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\Tenant;
use App\Rules\TenantExists;
use App\Rules\TenantUnique;
use App\Tenancy\MissingTenantException;
use App\Tenancy\Tenancy;
use App\Tenancy\TenantContext;
use Illuminate\Support\Facades\Validator;

beforeEach(function () {
    $this->a = Tenant::factory()->create();
    $this->b = Tenant::factory()->create();
    Domain::factory()->for($this->a)->create(['host' => 'a.platform.test', 'active_host' => 'a.platform.test']);
    Domain::factory()->for($this->b)->create(['host' => 'b.platform.test', 'active_host' => 'b.platform.test']);
});

it('returns nothing when no tenant is set (fail-closed)', function () {
    expect(app(TenantContext::class)->check())->toBeFalse()
        ->and(Domain::query()->count())->toBe(0)
        ->and(Domain::query()->find(1))->toBeNull();
});

it('filters by the current tenant', function () {
    $hosts = Tenancy::runAs($this->a->id, fn () => Domain::query()->pluck('host')->all());

    expect($hosts)->toBe(['a.platform.test']);
});

it('restores the previous tenant after runAs', function () {
    Tenancy::runAs($this->a->id, function () {
        Tenancy::runAs($this->b->id, fn () => null);
        expect(Tenancy::id())->toBe($this->a->id);
    });

    expect(Tenancy::id())->toBeNull();
});

it('sees all rows only inside withoutTenant', function () {
    expect(Tenancy::withoutTenant(fn () => Domain::query()->count()))->toBe(2)
        ->and(Domain::query()->count())->toBe(0);
});

it('throws when creating a tenant row without a tenant', function () {
    Domain::create(['host' => 'orphan.platform.test', 'type' => 'subdomain', 'status' => 'active']);
})->throws(MissingTenantException::class);

it('fills tenant_id from the context on create', function () {
    $domain = Tenancy::runAs($this->b->id, fn () => Domain::create([
        'host' => 'new.platform.test', 'type' => 'subdomain', 'status' => 'pending',
    ]));

    expect($domain->tenant_id)->toBe($this->b->id);
});

it('TenantExists only accepts rows of the current tenant', function () {
    $bDomainId = Tenancy::withoutTenant(fn () => Domain::query()->where('tenant_id', $this->b->id)->value('id'));
    $aDomainId = Tenancy::withoutTenant(fn () => Domain::query()->where('tenant_id', $this->a->id)->value('id'));

    Tenancy::runAs($this->a->id, function () use ($aDomainId, $bDomainId) {
        $rules = ['id' => [TenantExists::table('domains')]];

        expect(Validator::make(['id' => $aDomainId], $rules)->passes())->toBeTrue()
            ->and(Validator::make(['id' => $bDomainId], $rules)->passes())->toBeFalse();
    });
});

it('TenantExists fails without a tenant', function () {
    $id = Tenancy::withoutTenant(fn () => Domain::query()->value('id'));

    expect(Validator::make(['id' => $id], ['id' => [TenantExists::table('domains')]])->passes())->toBeFalse();
});

it('TenantUnique is scoped to the current tenant', function () {
    Tenancy::runAs($this->a->id, function () {
        $rules = ['host' => [TenantUnique::table('domains', 'host')]];

        expect(Validator::make(['host' => 'a.platform.test'], $rules)->passes())->toBeFalse()
            ->and(Validator::make(['host' => 'b.platform.test'], $rules)->passes())->toBeTrue()
            ->and(Validator::make(['host' => 'A.PLATFORM.TEST'], [
                'host' => [TenantUnique::table('domains', 'host')->caseInsensitive()],
            ])->passes())->toBeFalse();
    });
});
