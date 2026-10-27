<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sequential order numbers per tenant (row locked with lockForUpdate).
        Schema::create('order_counters', function (Blueprint $table) {
            $table->foreignId('tenant_id')->primary()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('last_number')->default(0);
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('order_number');
            $table->foreignId('landing_page_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('new');
            $table->timestamp('status_changed_at')->nullable();
            $table->string('customer_name', 80);
            $table->string('customer_phone', 20);
            $table->string('customer_phone2', 20)->nullable();
            $table->string('governorate', 40)->nullable();
            $table->string('city', 100)->nullable();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->text('internal_note')->nullable();
            // Custom field answers snapshot: [{key, label, type, value}]
            $table->json('answers')->nullable();
            $table->unsignedSmallInteger('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('subtotal', 12, 2);
            $table->unsignedBigInteger('offer_id')->nullable();
            $table->string('offer_name', 100)->nullable();
            $table->decimal('offer_discount', 12, 2)->default(0);
            $table->unsignedBigInteger('discount_code_id')->nullable();
            $table->string('discount_code', 30)->nullable();
            $table->decimal('code_discount', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->string('currency', 3)->default('EGP');
            $table->boolean('is_duplicate_suspect')->default(false);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->json('utm')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'order_number']);
            $table->index(['tenant_id', 'status', 'created_at']);
            $table->index(['tenant_id', 'customer_phone']);
            $table->index(['tenant_id', 'landing_page_id']);
            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_name', 150);
            // Unit price including option deltas.
            $table->decimal('unit_price', 12, 2);
            $table->unsignedSmallInteger('quantity');
            // Snapshot: [{option, value, price_delta}]
            $table->json('options')->nullable();
            $table->decimal('line_total', 12, 2);
            $table->timestamps();
        });

        Schema::create('order_status_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->string('note', 500)->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->index(['order_id', 'id']);
        });

        Schema::create('blocked_customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type', 10);
            $table->string('value', 45);
            $table->string('reason', 200)->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'type', 'value']);
        });

        Schema::table('discount_code_redemptions', function (Blueprint $table) {
            $table->foreign('order_id')->references('id')->on('orders')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('discount_code_redemptions', function (Blueprint $table) {
            $table->dropForeign(['order_id']);
        });
        Schema::dropIfExists('blocked_customers');
        Schema::dropIfExists('order_status_logs');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('order_counters');
    }
};
