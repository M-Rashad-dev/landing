<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The bell: one row per notification per dashboard user (merchants, super admins). The text is
 * written when it happens; `payload` keeps what the WhatsApp / email copy needs. A `dedupe_key`
 * stops the same reminder twice (e.g. "your plan ends in 3 days" for one period).
 * Users choose where the outside copy goes: WhatsApp (default) or email.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event', 40);
            $table->string('title', 200);
            $table->string('body', 600);
            $table->string('link', 300)->nullable();
            $table->json('payload')->nullable();
            $table->string('dedupe_key', 120)->nullable();
            $table->dateTime('read_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'dedupe_key']);
            $table->index(['user_id', 'id']);
            $table->index(['user_id', 'read_at']);
            $table->index(['created_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('notify_channel', 10)->default('whatsapp')->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('notify_channel'));
        Schema::dropIfExists('user_notifications');
    }
};
