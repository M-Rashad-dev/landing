<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Prepaid orders (docs/plans/digital-products.md, stage 3): the store's own ways to be paid before delivery
 * (InstaPay, wallets, bank transfer, a payment link). The customer pays, uploads the receipt, the merchant
 * confirms it. Cash on delivery stays the default and can be turned off.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);
            $table->string('name', 60);
            $table->string('account', 120)->nullable();
            $table->string('link', 500)->nullable();
            $table->text('instructions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedTinyInteger('position')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'position']);
        });

        Schema::create('store_payment_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('cod_enabled')->default(true);
            $table->unsignedTinyInteger('cancel_after_days')->default(3);
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_method', 10)->default('cod')->after('currency');
            $table->foreignId('store_payment_method_id')->nullable()->after('payment_method')->constrained()->nullOnDelete();
            $table->string('payment_method_name', 60)->nullable()->after('store_payment_method_id');
            $table->string('payment_status', 10)->nullable()->after('payment_method_name');
            $table->dateTime('paid_at')->nullable()->after('payment_status');

            $table->index(['tenant_id', 'payment_status']);
        });

        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('store_payment_method_id')->nullable()->constrained()->nullOnDelete();
            $table->string('method_name', 60);
            $table->decimal('amount', 12, 2);
            $table->string('sender_ref', 80)->nullable();
            $table->string('receipt_path', 255);
            $table->string('receipt_mime', 100);
            $table->string('status', 10)->default('pending');
            $table->string('reject_reason', 300)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'order_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_payments');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('store_payment_method_id');
            $table->dropIndex(['tenant_id', 'payment_status']);
            $table->dropColumn(['payment_method', 'payment_method_name', 'payment_status', 'paid_at']);
        });
        Schema::dropIfExists('store_payment_settings');
        Schema::dropIfExists('store_payment_methods');
    }
};
