<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Digital products (docs/plans/digital-products.md, stage 4): one kind «منتج رقمي» with a delivery type — files,
 * codes, links or services — delivered by email and on the order's page once the payment is confirmed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->string('kind', 10)->default('physical')->after('tenant_id');
            $table->string('delivery_type', 10)->nullable()->after('kind');
            // Per type: downloads / opens per purchase, the link (encrypted), the delivery message template.
            $table->text('delivery_settings')->nullable()->after('delivery_type');
        });

        Schema::create('product_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('path', 255);
            $table->string('original_name', 200);
            $table->string('mime', 100);
            $table->unsignedBigInteger('size');
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'product_id']);
        });

        Schema::create('product_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            // The option combination it belongs to ("" = the product without options), like product_variants.
            $table->string('combination_key', 100)->default('');
            $table->text('code');
            $table->unsignedSmallInteger('uses_total')->default(1);
            $table->unsignedSmallInteger('uses_left')->default(1);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'product_id', 'combination_key', 'uses_left'], 'product_codes_pick_index');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->string('delivery_type', 10)->nullable()->after('is_gift');
        });

        Schema::create('order_deliveries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_item_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 10);
            // pending (a service, or codes waiting for stock) | delivered
            $table->string('status', 10);
            $table->string('token', 40)->unique();
            // Encrypted: the codes sent, the link, the service message.
            $table->text('payload')->nullable();
            // Downloads used per file / link opens; the limit per purchase (null = unlimited) + extra granted.
            $table->json('usage')->nullable();
            $table->unsignedSmallInteger('limit')->nullable();
            $table->unsignedSmallInteger('bonus')->default(0);
            $table->dateTime('delivered_at')->nullable();
            $table->dateTime('emailed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'order_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_deliveries');
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('delivery_type');
        });
        Schema::dropIfExists('product_codes');
        Schema::dropIfExists('product_files');
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn(['kind', 'delivery_type', 'delivery_settings']);
        });
    }
};
