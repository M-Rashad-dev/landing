<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The merchants' AI balance (EGP). Two pots: «free» (the welcome credit and the owner's gifts,
 * usable on any plan to try the AI) and «paid» (top-ups and their bonus, usable only on plans
 * with the AI feature). Every move is an entry; a charge points at its AiUsage once (no double charge).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_wallets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('paid_balance', 12, 2)->default(0);
            $table->decimal('free_balance', 12, 2)->default(0);
            $table->boolean('welcomed')->default(false);
            $table->timestamp('low_notified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ai_wallet_entries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            // topup | bonus | welcome | gift | charge | adjust
            $table->string('type', 10);
            $table->decimal('amount', 12, 2);
            $table->decimal('paid_change', 12, 2)->default(0);
            $table->decimal('free_change', 12, 2)->default(0);
            $table->decimal('balance_after', 12, 2);
            $table->string('feature', 40)->nullable();
            $table->string('description', 200)->nullable();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('ai_usage_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'id']);
            $table->index(['tenant_id', 'type']);
        });

        Schema::table('ai_usages', function (Blueprint $table): void {
            // What the merchant was charged for this call (null = not charged: platform or free feature).
            $table->decimal('charged_egp', 12, 2)->nullable()->after('cost_usd');
        });
    }

    public function down(): void
    {
        Schema::table('ai_usages', fn (Blueprint $table) => $table->dropColumn('charged_egp'));
        Schema::dropIfExists('ai_wallet_entries');
        Schema::dropIfExists('ai_wallets');
    }
};
