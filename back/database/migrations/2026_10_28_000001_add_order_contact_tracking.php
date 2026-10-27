<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Call-center follow-up for new orders: attempts, last contact, callback time,
 * and a log of contact events (no answer, postponed, WhatsApp sent).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedSmallInteger('contact_attempts')->default(0)->after('internal_note');
            $table->timestamp('last_contacted_at')->nullable()->after('contact_attempts');
            $table->timestamp('follow_up_at')->nullable()->after('last_contacted_at');
            $table->index(['tenant_id', 'status', 'follow_up_at']);
        });

        Schema::create('order_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20);
            $table->string('note', 500)->nullable();
            $table->timestamp('follow_up_at')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['order_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_events');
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'status', 'follow_up_at']);
            $table->dropColumn(['contact_attempts', 'last_contacted_at', 'follow_up_at']);
        });
    }
};
