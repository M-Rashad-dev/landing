<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Online payment in the stores (Paymob, Kashier, XPay): the merchant connects his own gateway account (credentials
 * encrypted), it appears to customers as a payment method, and each checkout he opens there is tracked until it is
 * paid. The money goes from the customer to the merchant's gateway account; the platform never holds it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_gateway_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('gateway', 20);
            $table->text('credentials');
            // test | live, from the keys themselves.
            $table->string('mode', 10)->default('test');
            $table->string('status', 20)->default('active');
            // Our part of the webhook address (/webhooks/payments/{gateway}/{token}), unique platform-wide.
            $table->string('webhook_token', 40)->unique();
            $table->string('last_error', 255)->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'gateway']);
        });

        Schema::table('store_payment_methods', function (Blueprint $table) {
            // An online method (kind "online") is the gateway account's face at checkout.
            $table->string('gateway', 20)->nullable()->after('kind');
        });

        Schema::create('store_online_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('gateway', 20);
            // Ours, sent to the gateway as the merchant order reference; unique platform-wide.
            $table->string('reference', 60)->unique();
            // The gateway's checkout id (Paymob intention, Kashier session, XPay session).
            $table->string('external_id', 120)->nullable();
            $table->decimal('amount', 12, 2);
            // open → paid | failed | expired; waiting = paid later at a kiosk (Fawry / Aman), money not in yet.
            $table->string('status', 20)->default('open');
            $table->string('payment_ref', 120)->nullable();
            $table->string('method', 40)->nullable();
            $table->boolean('livemode')->default(false);
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'order_id']);
            $table->index(['gateway', 'external_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_online_payments');
        Schema::table('store_payment_methods', function (Blueprint $table) {
            $table->dropColumn('gateway');
        });
        Schema::dropIfExists('store_gateway_accounts');
    }
};
