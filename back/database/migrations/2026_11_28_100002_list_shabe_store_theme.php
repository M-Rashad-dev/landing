<?php

declare(strict_types=1);

use App\Billing\Themes\ThemeCatalog;
use App\Models\Theme;
use Database\Seeders\ThemeSeeder;
use Illuminate\Database\Migrations\Migration;

/**
 * «شابع · متجر» is finished (owner, 2026-11-17): its row was created hidden while it was being
 * built, and the seeder writes a theme's texts only once, so the row is listed here and gets its
 * final texts and tags. A fresh database gets it listed from ThemeSeeder directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        $theme = Theme::query()->find('shabe_store');
        $row = collect(ThemeSeeder::THEMES)->firstWhere('key', 'shabe_store');
        if ($theme === null || $row === null) {
            return;
        }
        $theme->update(['is_listed' => true, 'released_at' => $theme->released_at ?? now(), 'version' => $theme->version ?? '1.0']);
        ThemeSeeder::writeCopy($theme, $row);
        ThemeCatalog::flush();
    }

    public function down(): void
    {
        Theme::query()->whereKey('shabe_store')->update(['is_listed' => false]);
        ThemeCatalog::flush();
    }
};
