<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Abandoned cart recovery (docs/plans/merchant-essentials.md, stage 4): the store's settings, its WhatsApp message
 * balance (bought in packs, one reminder = one message) and its moves, the reminders each lead got, and the people
 * who asked to get no more.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cart_recovery_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(false);
            $table->boolean('whatsapp')->default(true);
            $table->boolean('email')->default(true);
            $table->unsignedSmallInteger('first_minutes')->default(60);
            // null = one reminder only.
            $table->unsignedSmallInteger('second_hours')->nullable()->default(24);
            // The second reminder's coupon: none · an existing code · a one-time code made per lead.
            $table->string('coupon_mode', 10)->default('none');
            $table->foreignId('discount_code_id')->nullable()->constrained()->nullOnDelete();
            $table->string('coupon_type', 12)->default('percentage');
            $table->decimal('coupon_value', 12, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('message_wallets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('balance')->default(0);
            // Told once that the balance ran out (cleared on the next top-up).
            $table->timestamp('empty_notified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('message_wallet_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('type', 12);
            $table->integer('messages');
            $table->unsignedInteger('balance_after');
            $table->string('description', 160)->nullable();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'id']);
        });

        Schema::create('lead_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('abandoned_lead_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('step');
            $table->string('channel', 10);
            $table->foreignId('outbound_message_id')->nullable()->constrained()->nullOnDelete();
            // One message taken from the balance (given back if WhatsApp says it failed).
            $table->boolean('charged')->default(false);
            $table->string('coupon_code', 40)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('recovery_opt_outs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('phone', 20)->nullable();
            $table->string('email', 191)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'phone']);
            $table->index(['tenant_id', 'email']);
        });

        // One-time codes made for a reminder: kept out of the coupons list and the plan's code limit.
        Schema::table('discount_codes', function (Blueprint $table) {
            $table->boolean('recovery')->default(false)->after('is_active');
        });

        Schema::table('abandoned_leads', function (Blueprint $table) {
            $table->string('customer_email', 191)->nullable()->after('customer_phone');
            $table->unsignedTinyInteger('reminders_sent')->default(0)->after('last_seen_at');
            $table->timestamp('last_reminded_at')->nullable()->after('reminders_sent');
            // An order came within 7 days of a reminder («رجعت بالتذكير»).
            $table->timestamp('recovered_at')->nullable()->after('last_reminded_at');
            // The restore link (sha256 of the token in the link).
            $table->string('recovery_token', 64)->nullable()->unique()->after('recovered_at');
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('abandoned_leads', function (Blueprint $table) {
            $table->dropIndex(['status', 'created_at']);
            $table->dropUnique(['recovery_token']);
            $table->dropColumn(['customer_email', 'reminders_sent', 'last_reminded_at', 'recovered_at', 'recovery_token']);
        });
        Schema::table('discount_codes', fn (Blueprint $t) => $t->dropColumn('recovery'));
        Schema::dropIfExists('recovery_opt_outs');
        Schema::dropIfExists('lead_reminders');
        Schema::dropIfExists('message_wallet_entries');
        Schema::dropIfExists('message_wallets');
        Schema::dropIfExists('cart_recovery_settings');
    }
};
