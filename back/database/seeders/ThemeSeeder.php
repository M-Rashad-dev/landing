<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Theme;
use Illuminate\Database\Seeder;

/** Safe to run on every deploy. */
class ThemeSeeder extends Seeder
{
    public function run(): void
    {
        $themes = [
            ['key' => 'malak', 'name' => 'ملاك', 'sort_order' => 1],
            ['key' => 'celia', 'name' => 'سيليا', 'sort_order' => 2],
        ];

        foreach ($themes as $theme) {
            $existing = Theme::query()->find($theme['key']);

            if ($existing === null) {
                Theme::create($theme + ['is_active' => true]);
            } else {
                // Keep the admin's is_active choice; refresh name and order only.
                $existing->update(['name' => $theme['name'], 'sort_order' => $theme['sort_order']]);
            }
        }
    }
}
