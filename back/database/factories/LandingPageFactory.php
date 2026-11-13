<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\PageStatus;
use App\Models\Identity;
use App\Models\LandingPage;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<LandingPage> */
class LandingPageFactory extends Factory
{
    protected $model = LandingPage::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'title' => 'صفحة '.fake()->word(),
            'slug' => 'page-'.Str::lower(Str::random(8)),
            'status' => PageStatus::Draft,
            'theme_key' => 'bidaya',
            'identity_id' => fn (array $attributes) => Tenancy::runAs((int) $attributes['tenant_id'], fn () => Identity::factory()->create()->id),
            'product_id' => null,
            'draft_content' => ['version' => 1, 'sections' => []],
            'version' => 1,
        ];
    }

    /** @param list<array<string, mixed>> $sections */
    public function withSections(array $sections): static
    {
        return $this->state(fn () => ['draft_content' => ['version' => 1, 'sections' => $sections]]);
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PageStatus::Published,
            'published_at' => now(),
            'published_content' => array_merge($attributes['draft_content'] ?? ['version' => 1, 'sections' => []], ['theme_key' => $attributes['theme_key'] ?? 'bidaya']),
        ]);
    }

    /** A valid section array for tests. */
    public static function section(string $type, array $props = [], bool $visible = true, string $variant = 'default'): array
    {
        return ['id' => (string) Str::uuid(), 'type' => $type, 'variant' => $variant, 'visible' => $visible, 'props' => $props];
    }
}
