<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The full online store (docs/features/1-STORES.md part B): one store per tenant on its own
 * domain, categories as a tree, products with stock, multi-product orders, store pages.
 * The store home is a landing_pages row (kind = store_home) edited in the existing Builder.
 */
return new class extends Migration
{
    public function up(): void
    {
        // S1: an order is a set of lines; landing orders keep their single-product columns.
        Schema::table('orders', function (Blueprint $table) {
            $table->string('source', 10)->default('landing')->after('landing_page_id');
            $table->unsignedSmallInteger('quantity')->nullable()->change();
            $table->decimal('unit_price', 12, 2)->nullable()->change();
            $table->index(['tenant_id', 'source', 'created_at']);
        });
        Schema::table('order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('variant_id')->nullable()->after('product_id');
            $table->string('offer_name', 100)->nullable()->after('options');
            $table->decimal('offer_discount', 12, 2)->default(0)->after('offer_name');
        });

        // S2: store fields on products + stock.
        Schema::table('products', function (Blueprint $table) {
            $table->string('slug', 120)->nullable()->after('name');
            $table->string('short_description', 300)->nullable()->after('description');
            $table->boolean('in_store')->default(true)->after('is_active');
            $table->boolean('is_featured')->default(false)->after('in_store');
            // unlimited | product | variant
            $table->string('stock_mode', 10)->default('unlimited')->after('is_featured');
            $table->integer('stock')->nullable()->after('stock_mode');
            $table->unsignedInteger('low_stock_threshold')->nullable()->after('stock');
            $table->json('seo')->nullable()->after('low_stock_threshold');

            $table->unique(['tenant_id', 'slug']);
            $table->index(['tenant_id', 'in_store', 'is_active']);
        });

        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // Sorted option value ids joined by "-": one row per combination of required options.
            $table->string('combination_key', 191);
            $table->string('sku', 60)->nullable();
            $table->integer('stock')->default(0);
            $table->timestamps();

            $table->unique(['product_id', 'combination_key']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('variant_id')->nullable();
            $table->integer('change');
            // order | restock | manual
            $table->string('reason', 20);
            $table->unsignedBigInteger('order_id')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['tenant_id', 'product_id', 'created_at']);
            $table->index('order_id');
        });

        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->unsignedTinyInteger('depth')->default(0);
            $table->string('name', 100);
            $table->string('slug', 120);
            $table->text('description')->nullable();
            $table->foreignId('media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_visible')->default(true);
            $table->json('seo')->nullable();
            $table->boolean('locked_by_plan')->default(false);
            $table->timestamps();

            $table->unique(['tenant_id', 'slug']);
            $table->index(['tenant_id', 'parent_id', 'position']);
        });

        Schema::create('category_product', function (Blueprint $table) {
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();

            $table->primary(['category_id', 'product_id']);
            $table->index('product_id');
        });

        // S3: the store itself (one per tenant).
        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('is_enabled')->default(false);
            $table->string('theme_key', 40);
            // The store home (kind = store_home) edited in the Builder.
            $table->foreignId('home_page_id')->nullable()->constrained('landing_pages')->nullOnDelete();
            // {header: [...], footer: [...]} menu items (S7).
            $table->json('menus')->nullable();
            $table->json('settings')->nullable();
            $table->json('seo')->nullable();
            $table->timestamps();

            $table->foreign('theme_key')->references('key')->on('themes')->cascadeOnUpdate()->restrictOnDelete();
        });

        Schema::table('landing_pages', function (Blueprint $table) {
            // landing | store_home
            $table->string('kind', 12)->default('landing')->after('tenant_id');
            $table->index(['tenant_id', 'kind']);
        });

        // S7: static pages (about, policies…).
        Schema::create('store_pages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120);
            $table->string('slug', 120);
            $table->text('body')->nullable();
            $table->boolean('is_published')->default(true);
            $table->json('seo')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'slug']);
        });

        // S5: abandoned store checkouts reuse abandoned_leads.
        Schema::table('abandoned_leads', function (Blueprint $table) {
            $table->string('source', 10)->default('landing')->after('tenant_id');
            $table->json('cart')->nullable()->after('quantity');
        });

        // S10: store traffic, one atomic counter row per Cairo day × source × device.
        Schema::create('store_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->string('source', 20);
            $table->string('device', 10);
            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('product_views')->default(0);
            $table->unsignedInteger('add_to_cart')->default(0);
            $table->unsignedInteger('checkouts')->default(0);

            $table->unique(['tenant_id', 'date', 'source', 'device'], 'store_stats_bucket');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_stats');
        Schema::table('abandoned_leads', fn (Blueprint $t) => $t->dropColumn(['source', 'cart']));
        Schema::dropIfExists('store_pages');
        Schema::table('landing_pages', function (Blueprint $t) {
            $t->dropIndex(['tenant_id', 'kind']);
            $t->dropColumn('kind');
        });
        Schema::dropIfExists('stores');
        Schema::dropIfExists('category_product');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('product_variants');
        Schema::table('products', function (Blueprint $t) {
            $t->dropUnique(['tenant_id', 'slug']);
            $t->dropIndex(['tenant_id', 'in_store', 'is_active']);
            $t->dropColumn(['slug', 'short_description', 'in_store', 'is_featured', 'stock_mode', 'stock', 'low_stock_threshold', 'seo']);
        });
        Schema::table('order_items', fn (Blueprint $t) => $t->dropColumn(['variant_id', 'offer_name', 'offer_discount']));
        Schema::table('orders', function (Blueprint $t) {
            $t->dropIndex(['tenant_id', 'source', 'created_at']);
            $t->dropColumn('source');
        });
    }
};
