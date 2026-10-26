<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\DomainStatus;
use App\Enums\DomainType;
use App\Enums\SslStatus;
use App\Models\Domain;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Domain> */
class DomainFactory extends Factory
{
    protected $model = Domain::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $host = fake()->unique()->lexify('store-????').'.'.config('landing.platform_domain');

        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'host' => $host,
            'type' => DomainType::Subdomain,
            'status' => DomainStatus::Active,
            'is_primary' => true,
            'active_host' => $host,
            'verified_at' => now(),
            'ssl_status' => SslStatus::Pending,
        ];
    }

    public function custom(string $host, DomainStatus $status = DomainStatus::Pending): static
    {
        return $this->state(fn () => [
            'host' => $host,
            'type' => DomainType::Custom,
            'status' => $status,
            'is_primary' => false,
            'active_host' => $status === DomainStatus::Active ? $host : null,
            'verified_at' => $status === DomainStatus::Active ? now() : null,
        ]);
    }
}
