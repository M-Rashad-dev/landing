<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Order messages to customers: the customer's WhatsApp consent at checkout (unchecked by default),
 * a private tracking token per order (the short link /t/{token}), the customer's own channel
 * choice from their store account, and the message log linked to its order (emails included).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->boolean('whatsapp_opt_in')->default(false)->after('customer_email');
            $table->string('track_token', 24)->nullable()->unique()->after('order_number');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->string('notify_channel', 10)->nullable()->after('email');
        });

        Schema::table('outbound_messages', function (Blueprint $table) {
            $table->foreignId('order_id')->nullable()->after('tenant_id')->constrained()->nullOnDelete();
            // Emails are logged too.
            $table->string('recipient', 191)->change();
        });
    }

    public function down(): void
    {
        Schema::table('outbound_messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('order_id');
            $table->string('recipient', 20)->change();
        });
        Schema::table('customers', fn (Blueprint $table) => $table->dropColumn('notify_channel'));
        Schema::table('orders', function (Blueprint $table) {
            $table->dropUnique(['track_token']);
            $table->dropColumn(['whatsapp_opt_in', 'track_token']);
        });
    }
};
