<?php

declare(strict_types=1);

namespace Tests\Fixtures;

use App\Models\Theme;
use App\Models\ThemeTag;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\Seeder;

/**
 * Tests only: the real reference data plus two paid landing themes, so buying, owning and
 * locking a paid theme can be tested while the platform itself ships only free themes.
 */
final class TestCatalogSeeder extends Seeder
{
    private const PAID = [
        ['key' => 'celia', 'name' => 'سيليا', 'sort_order' => 2, 'price' => 100, 'short_description' => 'ثيم جريء بحدود واضحة.', 'tags' => ['fashion', 'electronics']],
        ['key' => 'layali', 'name' => 'ليالي', 'sort_order' => 3, 'price' => 150, 'short_description' => 'ثيم ليلي فخم.', 'tags' => ['perfumes', 'accessories']],
    ];

    public function run(): void
    {
        $this->call(DatabaseSeeder::class);

        foreach (self::PAID as $row) {
            $theme = Theme::query()->firstOrCreate(['key' => $row['key']], ['name' => $row['name'], 'sort_order' => $row['sort_order'], 'is_active' => true]);
            $theme->update([
                'kind' => 'landing',
                'short_description' => $row['short_description'],
                'description' => $row['short_description'],
                'features' => ['ميزة'],
                'price' => $row['price'],
                'is_listed' => true,
                'released_at' => now()->subDays($row['sort_order']),
                'version' => '1.0',
            ]);
            $theme->tags()->sync(ThemeTag::query()->whereIn('slug', $row['tags'])->pluck('id')->all());
        }
    }
}
