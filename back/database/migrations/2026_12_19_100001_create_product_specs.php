<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «المواصفات» (docs/plans/tekno/PLAN.md §1): spec groups (a named table of labels the merchant reuses) and the
 * products' own spec tables. A group's rows are copied into a product when added, so a product may rename, add or
 * remove rows for itself; values are plain text. Deleting a group keeps the products' copies (unlinked).
 * Also the product's optional video link (YouTube / Vimeo), shown on the product page.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spec_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->unique(['tenant_id', 'name']);
        });

        Schema::create('spec_group_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('spec_group_id')->constrained()->cascadeOnDelete();
            $table->string('label', 60);
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('in_card')->default(false);
            $table->boolean('filterable')->default(false);
        });

        Schema::create('product_spec_tables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('spec_group_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 60);
            $table->unsignedSmallInteger('position')->default(0);

            $table->index(['tenant_id', 'product_id']);
        });

        Schema::create('product_spec_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_spec_table_id')->constrained()->cascadeOnDelete();
            $table->string('label', 60);
            $table->string('value', 200)->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('in_card')->default(false);
            $table->boolean('filterable')->default(false);

            // Spec filters on category pages (stage S2).
            $table->index(['tenant_id', 'label']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('video_url', 300)->nullable()->after('short_description');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('video_url');
        });
        Schema::dropIfExists('product_spec_rows');
        Schema::dropIfExists('product_spec_tables');
        Schema::dropIfExists('spec_group_rows');
        Schema::dropIfExists('spec_groups');
    }
};
