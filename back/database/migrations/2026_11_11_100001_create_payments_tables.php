<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Merchants paying the platform (docs/features/2-PAYMENTS.md). Manual transfers first
 * (InstaPay / wallets: receipt + admin review); a gateway plugs into the same invoices later.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Platform table: how merchants can pay, edited by the super admin.
        Schema::create('payment_methods', function (Blueprint $table) {
            $table->string('key', 40)->primary();
            $table->string('name', 60);
            // manual = transfer + receipt review; gateway = online checkout (later).
            $table->string('kind', 20)->default('manual');
            $table->string('account_label', 60)->nullable();
            $table->string('account_value', 120)->nullable();
            $table->text('instructions')->nullable();
            $table->boolean('is_active')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('number', 20)->nullable()->unique();
            $table->string('type', 20)->default('subscription');
            $table->string('plan_key', 40)->nullable();
            $table->string('period', 20)->nullable();
            // Upgrade = starts when paid; renewal / downgrade = after the current period.
            $table->boolean('starts_now')->default(true);
            $table->string('status', 20)->default('open');
            $table->decimal('subtotal', 12, 2);
            $table->decimal('discount', 12, 2)->default(0);
            $table->decimal('credit', 12, 2)->default(0);
            $table->decimal('total', 12, 2);
            $table->string('currency', 3)->default('EGP');
            // Plan, price and quote at creation: later price changes never touch an invoice.
            $table->json('snapshot');
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->unsignedBigInteger('subscription_id')->nullable();
            $table->timestamp('refund_requested_at')->nullable();
            $table->string('refund_reason', 500)->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->string('refund_ref', 120)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'created_at']);
            $table->index(['status', 'expires_at']);
            $table->index('refund_requested_at');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->string('method_key', 40);
            $table->decimal('amount', 12, 2);
            // Transfer reference / sender number the merchant typed.
            $table->string('sender_ref', 120);
            // Private disk (never a public URL).
            $table->string('receipt_path', 255)->nullable();
            $table->string('status', 20)->default('pending_review');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('reject_reason', 500)->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['tenant_id', 'invoice_id']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->unsignedBigInteger('invoice_id')->nullable()->after('source');
            $table->index('invoice_id');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropIndex(['invoice_id']);
            $table->dropColumn('invoice_id');
        });
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('payment_methods');
    }
};
