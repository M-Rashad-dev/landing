<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\UserRole;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<User> */
class UserFactory extends Factory
{
    protected $model = User::class;

    protected static ?string $password = null;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'tenant_id' => Tenant::factory(),
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '+2010'.fake()->unique()->numerify('########'),
            'password' => static::$password ??= 'password123',
            'role' => UserRole::Owner,
            'is_active' => true,
        ];
    }

    public function superAdmin(): static
    {
        return $this->state(fn () => ['tenant_id' => null, 'role' => UserRole::SuperAdmin]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
