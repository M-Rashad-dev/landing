<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The theme store (docs/features/1-STORES.md part A): catalog details on the existing themes
 * table (platform), images and tags (platform), and what each store owns (tenant).
 * A theme is code; the admin edits only how it is shown and sold.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('themes', function (Blueprint $table) {
            // landing = one-product page; store = full store (with the stores feature).
            $table->string('kind', 20)->default('landing')->after('name');
            $table->string('short_description', 200)->nullable()->after('kind');
            $table->text('description')->nullable()->after('short_description');
            $table->json('features')->nullable()->after('description');
            $table->decimal('price', 12, 2)->default(0)->after('features');
            $table->unsignedTinyInteger('discount_percent')->default(0)->after('price');
            $table->timestamp('discount_starts_at')->nullable()->after('discount_percent');
            $table->timestamp('discount_ends_at')->nullable()->after('discount_starts_at');
            $table->string('min_plan_key', 40)->nullable()->after('discount_ends_at');
            $table->boolean('is_featured')->default(false)->after('min_plan_key');
            // Shown in the theme store (a new theme starts hidden until the admin fills it in).
            $table->boolean('is_listed')->default(false)->after('is_featured');
            $table->string('version', 20)->nullable()->after('is_listed');
            $table->timestamp('released_at')->nullable()->after('version');
        });

        Schema::create('theme_images', function (Blueprint $table) {
            $table->id();
            $table->string('theme_key', 40);
            // cover | desktop | mobile
            $table->string('kind', 20)->default('desktop');
            // Public disk, platform/themes/{key}/…
            $table->json('variants');
            $table->unsignedSmallInteger('width');
            $table->unsignedSmallInteger('height');
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->foreign('theme_key')->references('key')->on('themes')->cascadeOnUpdate()->cascadeOnDelete();
            $table->index(['theme_key', 'position']);
        });

        Schema::create('theme_tags', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 60)->unique();
            $table->string('name', 60);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('theme_tag', function (Blueprint $table) {
            $table->string('theme_key', 40);
            $table->foreignId('theme_tag_id')->constrained()->cascadeOnDelete();

            $table->primary(['theme_key', 'theme_tag_id']);
            $table->foreign('theme_key')->references('key')->on('themes')->cascadeOnUpdate()->cascadeOnDelete();
        });

        Schema::create('theme_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('theme_key', 40);
            // purchase | admin_grant
            $table->string('source', 20);
            $table->unsignedBigInteger('invoice_id')->nullable();
            $table->decimal('price_paid', 12, 2)->default(0);
            $table->string('note', 300)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('theme_key')->references('key')->on('themes')->cascadeOnUpdate()->restrictOnDelete();
            $table->unique(['tenant_id', 'theme_key']);
            $table->index('theme_key');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->string('theme_key', 40)->nullable()->after('period');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', fn (Blueprint $table) => $table->dropColumn('theme_key'));
        Schema::dropIfExists('theme_purchases');
        Schema::dropIfExists('theme_tag');
        Schema::dropIfExists('theme_tags');
        Schema::dropIfExists('theme_images');
        Schema::table('themes', function (Blueprint $table) {
            $table->dropColumn([
                'kind', 'short_description', 'description', 'features', 'price', 'discount_percent', 'discount_starts_at',
                'discount_ends_at', 'min_plan_key', 'is_featured', 'is_listed', 'version', 'released_at',
            ]);
        });
    }
};
