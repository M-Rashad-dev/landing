<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Offer rules: minimum quantity (buy 2 → 20% off), buy X get Y free, and a free gift product;
 * order items remember which line was the gift.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->unsignedSmallInteger('min_quantity')->default(1)->after('bundle_price');
            $table->unsignedSmallInteger('free_quantity')->nullable()->after('min_quantity');
            $table->foreignId('gift_product_id')->nullable()->after('free_quantity')->constrained('products')->nullOnDelete();
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->boolean('is_gift')->default(false)->after('upsell_id');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('is_gift');
        });
        Schema::table('offers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('gift_product_id');
            $table->dropColumn(['min_quantity', 'free_quantity']);
        });
    }
};
