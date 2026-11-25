<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Online payment of the platform's invoices (XPay hosted checkout): one row per checkout session a merchant opened.
 * The session is the gateway's; this row ties it to the invoice and records how it ended.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('online_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->string('gateway', 20);
            $table->string('method_key', 40);
            // The gateway's session id (cs_test_… / cs_live_…), unique across every store.
            $table->string('external_id', 100)->unique();
            $table->decimal('amount', 12, 2);
            // open → paid | failed | expired; waiting = the customer chose a pay-later method (Fawry) and the money isn't in yet.
            $table->string('status', 20)->default('open');
            $table->string('payment_ref', 100)->nullable();
            $table->boolean('livemode')->default(false);
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'invoice_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('online_payments');
    }
};
