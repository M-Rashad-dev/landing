<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\OptionDisplayType;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Product> */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'name' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'price' => '350.00',
            'compare_at_price' => null,
            'sku' => null,
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    /**
     * Adds one option with the given values: [label => price_delta].
     *
     * @param  array<string, string>  $values
     */
    public function withOption(string $name, array $values, bool $required = true, OptionDisplayType $type = OptionDisplayType::Buttons): static
    {
        return $this->afterCreating(function (Product $product) use ($name, $values, $required, $type): void {
            Tenancy::runAs($product->tenant_id, function () use ($product, $name, $values, $required, $type): void {
                $option = ProductOption::create([
                    'product_id' => $product->id,
                    'name' => $name,
                    'display_type' => $type,
                    'is_required' => $required,
                    'position' => $product->options()->count(),
                ]);

                $position = 0;
                foreach ($values as $label => $delta) {
                    ProductOptionValue::create([
                        'option_id' => $option->id,
                        'label' => (string) $label,
                        'color_hex' => $type === OptionDisplayType::Swatch ? '#000000' : null,
                        'price_delta' => $delta,
                        'is_active' => true,
                        'position' => $position++,
                    ]);
                }
            });
        });
    }
}
