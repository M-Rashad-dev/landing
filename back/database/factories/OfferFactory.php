<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\OfferType;
use App\Models\Offer;
use App\Models\Product;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Offer> */
class OfferFactory extends Factory
{
    protected $model = Offer::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'name' => 'عرض '.fake()->word(),
            'type' => OfferType::Percentage,
            'value' => '10.00',
            'bundle_quantity' => null,
            'bundle_price' => null,
            'starts_at' => null,
            'ends_at' => null,
            'is_active' => true,
            'badge_text' => null,
            'priority' => 0,
        ];
    }

    public function percentage(int $percent): static
    {
        return $this->state(fn () => ['type' => OfferType::Percentage, 'value' => $percent.'.00']);
    }

    public function fixed(string $perUnit): static
    {
        return $this->state(fn () => ['type' => OfferType::Fixed, 'value' => $perUnit]);
    }

    public function bundle(int $quantity, string $price): static
    {
        return $this->state(fn () => ['type' => OfferType::Bundle, 'value' => null, 'bundle_quantity' => $quantity, 'bundle_price' => $price]);
    }

    public function forProduct(Product $product): static
    {
        return $this->afterCreating(fn (Offer $offer) => $offer->products()->attach($product->id, ['tenant_id' => $offer->tenant_id]));
    }
}
