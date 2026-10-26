<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('type', 20);
            // percentage: 1–95 · fixed: discount per unit
            $table->decimal('value', 12, 2)->nullable();
            $table->unsignedSmallInteger('bundle_quantity')->nullable();
            // Price of the whole bundle.
            $table->decimal('bundle_price', 12, 2)->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('badge_text', 40)->nullable();
            $table->integer('priority')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'is_active', 'starts_at', 'ends_at']);
        });

        Schema::create('offer_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('offer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['offer_id', 'product_id']);
            $table->index(['tenant_id', 'product_id']);
        });

        Schema::create('discount_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            // Stored UPPERCASE. Soft-deleted codes are renamed CODE--DEL{id} to free the value.
            $table->string('code', 60);
            $table->string('type', 20);
            $table->decimal('value', 12, 2);
            $table->decimal('max_discount', 12, 2)->nullable();
            $table->decimal('min_order_total', 12, 2)->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->unsignedInteger('usage_limit')->nullable();
            $table->unsignedInteger('usage_limit_per_phone')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->boolean('stackable_with_offers')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
        });

        Schema::create('discount_code_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('discount_code_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['discount_code_id', 'product_id']);
            $table->index(['tenant_id', 'product_id']);
        });

        Schema::create('discount_code_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('discount_code_id')->constrained()->cascadeOnDelete();
            // FK to orders is added with the orders table (phase 9).
            $table->unsignedBigInteger('order_id')->unique();
            $table->string('phone', 20);
            $table->decimal('amount', 12, 2);
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->index(['discount_code_id', 'phone', 'released_at'], 'dcr_code_phone_released_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_code_redemptions');
        Schema::dropIfExists('discount_code_products');
        Schema::dropIfExists('discount_codes');
        Schema::dropIfExists('offer_products');
        Schema::dropIfExists('offers');
    }
};
