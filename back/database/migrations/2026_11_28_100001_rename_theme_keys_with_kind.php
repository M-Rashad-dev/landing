<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Owner decision (2026-11-17): every theme key carries its kind, because store and landing
 * themes will share design names («صوفي» store and «صوفي» landing are two themes bought apart).
 * The theme row is copied under its new key, every row pointing at it moves over, then the old
 * row goes (landing_pages has no ON UPDATE CASCADE, so the key isn't updated in place).
 * Invoices keep their old snapshot texts; only their theme_key column moves.
 */
return new class extends Migration
{
    private const KEYS = [
        'asas' => 'asas_store',
        'sufi' => 'sufi_store',
        'bidaya' => 'bidaya_landing',
        'shabe' => 'shabe_landing',
    ];

    private const TABLES = ['theme_images', 'theme_tag', 'theme_purchases', 'invoices', 'stores', 'store_designs', 'landing_pages'];

    public function up(): void
    {
        $this->move(self::KEYS);
    }

    public function down(): void
    {
        $this->move(array_flip(self::KEYS));
    }

    /** @param array<string, string> $keys old => new */
    private function move(array $keys): void
    {
        DB::transaction(function () use ($keys): void {
            foreach ($keys as $old => $new) {
                $row = DB::table('themes')->where('key', $old)->first();
                if ($row === null) {
                    continue;
                }
                if (! DB::table('themes')->where('key', $new)->exists()) {
                    DB::table('themes')->insert(['key' => $new] + (array) $row);
                }
                foreach (self::TABLES as $table) {
                    DB::table($table)->where('theme_key', $old)->update(['theme_key' => $new]);
                }
                $this->movePublishedContent($old, $new);
                DB::table('themes')->where('key', $old)->delete();
            }
        });
    }

    /** The live landing page keeps the theme it was published with inside its content. */
    private function movePublishedContent(string $old, string $new): void
    {
        DB::table('landing_pages')->whereNotNull('published_content')->orderBy('id')->select(['id', 'published_content'])
            ->chunkById(200, function ($pages) use ($old, $new): void {
                foreach ($pages as $page) {
                    $content = json_decode((string) $page->published_content, true);
                    if (is_array($content) && ($content['theme_key'] ?? null) === $old) {
                        $content['theme_key'] = $new;
                        DB::table('landing_pages')->where('id', $page->id)->update(['published_content' => json_encode($content, JSON_UNESCAPED_UNICODE)]);
                    }
                }
            });
    }
};
