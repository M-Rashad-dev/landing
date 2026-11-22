<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * How a store's customer emails go out (docs/plans/digital-products.md, stage 1): from the platform with the
 * store's name and replies to the merchant (default), or from the merchant's own mailbox (SMTP, app password).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_mail_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('mode', 10)->default('platform');
            $table->string('sender_name', 60)->nullable();
            $table->string('reply_to', 191)->nullable();
            $table->string('smtp_host', 191)->nullable();
            $table->unsignedSmallInteger('smtp_port')->nullable();
            $table->string('smtp_encryption', 8)->nullable();
            $table->string('smtp_username', 191)->nullable();
            $table->text('smtp_password')->nullable();
            $table->string('from_address', 191)->nullable();
            $table->string('status', 10)->nullable();
            $table->string('last_error', 255)->nullable();
            $table->dateTime('checked_at')->nullable();
            $table->timestamps();
        });

        // Which mailbox an email left from: the platform's or the store's own.
        Schema::table('outbound_messages', function (Blueprint $table) {
            $table->string('via', 10)->nullable()->after('channel');
        });
    }

    public function down(): void
    {
        Schema::table('outbound_messages', function (Blueprint $table) {
            $table->dropColumn('via');
        });
        Schema::dropIfExists('store_mail_settings');
    }
};
