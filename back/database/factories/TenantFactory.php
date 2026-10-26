<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\TenantStatus;
use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Tenant> */
class TenantFactory extends Factory
{
    protected $model = Tenant::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'status' => TenantStatus::Active,
        ];
    }

    public function suspended(): static
    {
        return $this->state(fn () => [
            'status' => TenantStatus::Suspended,
            'suspended_at' => now(),
            'suspended_reason' => 'test',
        ]);
    }
}
