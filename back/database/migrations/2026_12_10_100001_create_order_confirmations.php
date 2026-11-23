<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Order confirmation on WhatsApp (docs/plans/merchant-essentials.md, stage 2): a cash-on-delivery order gets a message
 * with «أكّد» / «الغي» / «عايز أكلم حد»; the order moves by itself. Free for the store (the platform's number).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_confirmation_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(false);
            $table->unsignedSmallInteger('delay_minutes')->default(0);
            // One reminder after these hours without a reply (null = no reminder).
            $table->unsignedTinyInteger('reminder_hours')->nullable()->default(6);
            // After these hours without a reply: «ماردّش» (keep) or cancel.
            $table->unsignedTinyInteger('final_hours')->default(24);
            $table->string('on_timeout', 10)->default('keep');
            $table->timestamps();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('confirm_state', 12)->nullable()->after('payment_status');
            $table->dateTime('confirm_sent_at')->nullable()->after('confirm_state');
            $table->dateTime('confirm_reminded_at')->nullable()->after('confirm_sent_at');
            $table->dateTime('confirm_replied_at')->nullable()->after('confirm_reminded_at');

            $table->index(['confirm_state', 'confirm_sent_at']);
            $table->index(['customer_phone', 'confirm_state']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['confirm_state', 'confirm_sent_at']);
            $table->dropIndex(['customer_phone', 'confirm_state']);
            $table->dropColumn(['confirm_state', 'confirm_sent_at', 'confirm_reminded_at', 'confirm_replied_at']);
        });
        Schema::dropIfExists('order_confirmation_settings');
    }
};
