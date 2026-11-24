<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Refunds (docs/plans/merchant-essentials.md, stage 5): money already collected going back to the customer — asked
 * («مطلوب»), then done with its reference / proof or called off; the order keeps the refunded total.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_refunds', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            // Optional lines for a partial refund: [{order_item_id, quantity}].
            $table->json('items')->nullable();
            $table->string('reason', 300)->nullable();
            $table->string('method', 20);
            $table->string('destination', 120)->nullable();
            $table->string('reference', 120)->nullable();
            $table->string('proof_path')->nullable();
            $table->string('proof_mime', 100)->nullable();
            $table->string('status', 20)->default('pending');
            // What completing it does: the returned units back in stock, the digital lines stopped.
            $table->boolean('restock')->default(false);
            $table->boolean('revoke_digital')->default(false);
            $table->timestamp('restocked_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('done_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('done_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'created_at']);
            $table->index(['tenant_id', 'done_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            // Sum of the done refunds; refund_state: null | partial | full.
            $table->decimal('refunded_total', 12, 2)->default(0)->after('paid_at');
            $table->string('refund_state', 20)->nullable()->after('refunded_total');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['refunded_total', 'refund_state']);
        });
        Schema::dropIfExists('order_refunds');
    }
};
