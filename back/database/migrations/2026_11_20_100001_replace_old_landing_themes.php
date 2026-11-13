<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Owner decision (Nov 2026): landing pages start again on the new free theme «بداية». The three
 * old landing themes (ملاك، سيليا، ليالي) and every landing page built on the old system are
 * removed. Orders and leads keep their rows (their page link becomes empty); invoices stay as
 * money records. The store home pages (kind = store) are not touched.
 */
return new class extends Migration
{
    private const OLD = ['malak', 'celia', 'layali'];

    public function up(): void
    {
        // Stats, A/B rows and media links of these pages cascade; orders / leads / stores set null.
        DB::table('landing_pages')->where('kind', 'landing')->delete();

        // A store's ownership of an old theme (restrictOnDelete on themes).
        DB::table('theme_purchases')->whereIn('theme_key', self::OLD)->delete();

        // The theme images' files (the rows cascade with the theme).
        foreach (DB::table('theme_images')->whereIn('theme_key', self::OLD)->pluck('variants') as $variants) {
            foreach ((array) json_decode((string) $variants, true) as $path) {
                if (is_string($path)) {
                    Storage::disk('public')->delete($path);
                }
            }
        }
        DB::table('themes')->whereIn('key', self::OLD)->delete();
        // «بداية» itself comes from ThemeSeeder (it runs on every deploy).
    }

    public function down(): void
    {
        // The old themes and pages are gone for good (owner decision); nothing to restore.
    }
};
