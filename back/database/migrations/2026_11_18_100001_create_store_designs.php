<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The store is designed per theme (owner, Nov 2026): one design row per store and theme with
 * its draft and published versions (home sections + theme settings). «أساس» replaces the old
 * store themes; the store home is no longer a landing page; store look settings move into the design.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        if (! DB::table('themes')->where('key', 'asas')->exists()) {
            DB::table('themes')->insert([
                'key' => 'asas',
                'name' => 'أساس',
                'kind' => 'store',
                'sort_order' => 10,
                'is_active' => true,
                'is_listed' => true,
                'price' => 0,
                'short_description' => 'ثيم المتجر المجاني: بسيط وسريع، وكل اللي محتاجه علشان تبيع.',
                'released_at' => $now,
                'version' => '1.0',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::create('store_designs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('theme_key', 40);
            $table->json('draft');
            $table->json('published')->nullable();
            $table->timestamp('published_at')->nullable();
            // Bumped on every save: two tabs editing the same design do not overwrite each other.
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();

            $table->foreign('theme_key')->references('key')->on('themes')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unique(['tenant_id', 'theme_key']);
        });

        DB::table('stores')->update(['theme_key' => 'asas']);

        $homes = DB::table('stores')->whereNotNull('home_page_id')->pluck('home_page_id');
        Schema::table('stores', function (Blueprint $table) {
            $table->dropConstrainedForeignId('home_page_id');
            $table->dropColumn('settings');
        });
        DB::table('landing_pages')->whereIn('id', $homes)->orWhere('kind', 'store_home')->delete();

        DB::table('theme_purchases')->whereIn('theme_key', ['rewaq', 'diwan'])->delete();
        DB::table('themes')->whereIn('key', ['rewaq', 'diwan'])->delete();
    }

    public function down(): void
    {
        Schema::dropIfExists('store_designs');
        Schema::table('stores', function (Blueprint $table) {
            $table->foreignId('home_page_id')->nullable()->constrained('landing_pages')->nullOnDelete();
            $table->json('settings')->nullable();
        });
    }
};
