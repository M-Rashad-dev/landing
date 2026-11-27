<?php

declare(strict_types=1);

use App\Billing\Themes\ThemeCatalog;
use App\Models\Theme;
use Database\Seeders\ThemeSeeder;
use Illuminate\Database\Migrations\Migration;

/**
 * «رواق» (beauty store theme) is finished (owner, 2026-11-27: three stages and the AI quiz): its row was
 * created hidden while it was being built, and the seeder writes a theme's texts only once, so the row is
 * listed here and gets its final texts and tags. A fresh database gets it listed from ThemeSeeder directly.
 */
return new class extends Migration
{
    public function up(): void
    {
        $theme = Theme::query()->find('rawaq_store');
        $row = collect(ThemeSeeder::THEMES)->firstWhere('key', 'rawaq_store');
        if ($theme === null || $row === null) {
            return;
        }
        $theme->update(['is_listed' => true, 'released_at' => $theme->released_at ?? now(), 'version' => $theme->version ?? '1.0']);
        ThemeSeeder::writeCopy($theme, $row);
        ThemeCatalog::flush();
    }

    public function down(): void
    {
        Theme::query()->whereKey('rawaq_store')->update(['is_listed' => false]);
        ThemeCatalog::flush();
    }
};
