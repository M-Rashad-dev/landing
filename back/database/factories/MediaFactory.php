<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Media;
use App\Models\Tenant;
use App\Tenancy\Tenancy;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Media> */
class MediaFactory extends Factory
{
    protected $model = Media::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $base = 'tenants/0/2026/10/'.Str::lower((string) Str::ulid());

        return [
            // Inside Tenancy::runAs() rows belong to the current tenant.
            'tenant_id' => fn () => Tenancy::id() ?? Tenant::factory()->create()->id,
            'disk' => 'public',
            'path' => "{$base}-large.webp",
            'variants' => [
                'thumb' => "{$base}-thumb.webp",
                'medium' => "{$base}-medium.webp",
                'large' => "{$base}-large.webp",
            ],
            'original_name' => fake()->word().'.jpg',
            'mime' => 'image/webp',
            'size_bytes' => 12345,
            'width' => 1200,
            'height' => 800,
        ];
    }
}
