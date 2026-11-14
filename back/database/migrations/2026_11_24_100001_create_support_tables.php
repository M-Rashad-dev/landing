<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Support chat between a store and the platform: tickets (with a number the merchant can quote),
 * their messages, and the images / videos sent in them. Rated once closed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('number')->nullable()->unique();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('topic', 20);
            $table->string('status', 20);
            $table->string('close_reason', 20)->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedSmallInteger('reopened_count')->default(0);
            $table->timestamp('last_message_at', 6)->nullable();
            $table->timestamp('last_merchant_message_at', 6)->nullable();
            $table->timestamp('last_support_message_at', 6)->nullable();
            $table->timestamp('first_response_at')->nullable();
            $table->timestamp('merchant_read_at', 6)->nullable();
            $table->timestamp('support_read_at', 6)->nullable();
            $table->unsignedTinyInteger('rating')->nullable();
            $table->boolean('rating_resolved')->nullable();
            $table->string('rating_comment', 500)->nullable();
            $table->timestamp('rated_at')->nullable();
            $table->json('context')->nullable();
            // Microseconds on the message / read times: a reply in the same second as a read still counts as unread.
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['status', 'last_message_at']);
            $table->index(['status', 'last_support_message_at']);
        });

        Schema::create('support_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('support_ticket_id')->constrained()->cascadeOnDelete();
            $table->string('sender', 10);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body')->nullable();
            $table->timestamps();

            $table->index(['support_ticket_id', 'id']);
        });

        Schema::create('support_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('support_ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('support_message_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);
            $table->string('path', 300);
            $table->string('name', 200);
            $table->string('mime', 100);
            $table->unsignedBigInteger('size');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_attachments');
        Schema::dropIfExists('support_messages');
        Schema::dropIfExists('support_tickets');
    }
};
