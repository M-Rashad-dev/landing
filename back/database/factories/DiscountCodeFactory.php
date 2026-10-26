<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\DiscountType;
use App\Models\DiscountCode;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<DiscountCode> */
class DiscountCodeFactory extends Factory
{
    protected $model = DiscountCode::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'code' => strtoupper(fake()->unique()->bothify('CODE##??')),
            'type' => DiscountType::Percentage,
            'value' => '10.00',
            'max_discount' => null,
            'min_order_total' => null,
            'starts_at' => null,
            'ends_at' => null,
            'usage_limit' => null,
            'usage_limit_per_phone' => null,
            'stackable_with_offers' => true,
            'is_active' => true,
        ];
    }

    public function percentage(int $percent, ?string $max = null): static
    {
        return $this->state(fn () => ['type' => DiscountType::Percentage, 'value' => $percent.'.00', 'max_discount' => $max]);
    }

    public function fixed(string $amount): static
    {
        return $this->state(fn () => ['type' => DiscountType::Fixed, 'value' => $amount]);
    }
}
