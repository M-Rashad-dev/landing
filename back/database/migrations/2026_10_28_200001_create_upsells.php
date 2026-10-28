<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Post-order offers: shown on the success screen, one click adds the product to the order. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('upsells', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            // Null = after any order.
            $table->foreignId('trigger_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->foreignId('offer_product_id')->constrained('products')->cascadeOnDelete();
            $table->decimal('price', 12, 2);
            $table->string('headline', 150);
            $table->string('description', 300)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('priority')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'is_active']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->foreignId('upsell_id')->nullable()->after('product_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('upsell_id');
        });
        Schema::dropIfExists('upsells');
    }
};
