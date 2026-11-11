<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A product in several categories names one as its main category (store breadcrumb, SEO).
 * Existing products take their first category.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->foreignId('primary_category_id')->nullable()->after('is_featured')->constrained('categories')->nullOnDelete();
        });

        DB::table('category_product')
            ->select('product_id', DB::raw('MIN(category_id) as category_id'))
            ->groupBy('product_id')
            ->orderBy('product_id')
            ->each(function (object $row): void {
                DB::table('products')->where('id', $row->product_id)->update(['primary_category_id' => $row->category_id]);
            });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropConstrainedForeignId('primary_category_id');
        });
    }
};
