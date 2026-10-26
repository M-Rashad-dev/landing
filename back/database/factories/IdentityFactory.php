<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Identity;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Identity> */
class IdentityFactory extends Factory
{
    protected $model = Identity::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'name' => fake()->words(2, true),
            'is_default' => false,
            'brand_name' => fake()->company(),
            'colors' => config('landing.default_colors'),
            'font_heading' => 'cairo',
            'font_body' => 'cairo',
            'button_radius' => 'md',
            'contact' => [],
            'socials' => [],
            'tracking' => ['conversion_event' => 'Lead'],
        ];
    }

    public function default(): static
    {
        return $this->state(fn () => ['is_default' => true]);
    }
}
