<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Storefront customer accounts (phone + one-time code, on the existing customers row), their
 * sign-in tokens and saved addresses, and product reviews by customers who received the product.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_login_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('phone', 20);
            $table->char('code_hash', 64);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->dateTime('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'phone', 'created_at']);
        });

        Schema::create('customer_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->string('user_agent', 300)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->dateTime('expires_at');
            $table->timestamps();
        });

        Schema::create('customer_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('governorate', 60);
            $table->string('city', 100)->nullable();
            $table->string('address', 300);
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['tenant_id', 'customer_id']);
        });

        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('text')->nullable();
            $table->string('author_name', 80);
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();

            $table->unique(['tenant_id', 'product_id', 'customer_id']);
            $table->index(['tenant_id', 'product_id', 'is_hidden']);
            $table->index(['tenant_id', 'is_hidden', 'created_at']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->timestamp('signed_up_at')->nullable()->after('block_exempt');
        });
    }

    public function down(): void
    {
        Schema::table('customers', fn (Blueprint $table) => $table->dropColumn('signed_up_at'));
        Schema::dropIfExists('product_reviews');
        Schema::dropIfExists('customer_addresses');
        Schema::dropIfExists('customer_tokens');
        Schema::dropIfExists('customer_login_codes');
    }
};
