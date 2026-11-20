<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The AI store copilot (docs/plans/ai-copilot.md §3.2): the merchant's chats with it, their
 * messages, every change it prepared (a change set + one item per touched record, so previews page,
 * stale rows are skipped one by one and reverts are exact) and the Excel files it built.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('copilot_chats', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('title', 120)->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'user_id', 'closed_at']);
        });

        Schema::create('copilot_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chat_id')->constrained('copilot_chats')->cascadeOnDelete();
            // user | assistant
            $table->string('role', 10);
            $table->mediumText('text')->nullable();
            // Where the merchant was: page, open record, selected rows.
            $table->json('context')->nullable();
            // {media_ids: int[], import_id: ?int}
            $table->json('attachments')->nullable();
            // Server-built cards: tables, change sets, exports, handoffs…
            $table->json('blocks')->nullable();
            // pending | done | failed
            $table->string('status', 10)->default('done');
            $table->string('progress', 160)->nullable();
            // Tool names, sizes and round costs (never customer data).
            $table->json('trace')->nullable();
            $table->string('error', 300)->nullable();
            $table->timestamps();
            $table->index(['chat_id', 'id']);
        });

        Schema::create('copilot_change_sets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chat_id')->nullable()->constrained('copilot_chats')->nullOnDelete();
            $table->foreignId('message_id')->nullable()->constrained('copilot_messages')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // create | update | action | revert | job
            $table->string('kind', 10);
            // The resource or action key.
            $table->string('target', 80);
            $table->string('summary', 255);
            $table->json('spec');
            // estimate | running | proposed | applying | applied | rejected | expired | failed | reverted
            $table->string('status', 12);
            $table->boolean('keep_draft')->default(false);
            $table->boolean('reversible')->default(true);
            $table->json('side_effects')->nullable();
            $table->unsignedInteger('estimate_cents')->nullable();
            $table->unsignedInteger('items_count')->default(0);
            $table->unsignedInteger('applied_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->foreignId('reverts_id')->nullable()->constrained('copilot_change_sets')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('error', 300)->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status', 'expires_at']);
        });

        Schema::create('copilot_change_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('change_set_id')->constrained('copilot_change_sets')->cascadeOnDelete();
            // The resource key (products, discount_codes…).
            $table->string('entity_type', 40);
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('label', 160);
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            // pending | applied | skipped_stale | skipped_invalid | failed | reverted | kept
            $table->string('status', 16)->default('pending');
            $table->string('note', 200)->nullable();
            $table->timestamps();
            $table->index(['change_set_id', 'status']);
            $table->index(['tenant_id', 'entity_type', 'entity_id']);
        });

        Schema::create('copilot_exports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('chat_id')->nullable()->constrained('copilot_chats')->nullOnDelete();
            $table->string('token', 64)->unique();
            $table->string('filename', 120);
            $table->string('path', 255);
            $table->unsignedInteger('rows_count')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('copilot_exports');
        Schema::dropIfExists('copilot_change_items');
        Schema::dropIfExists('copilot_change_sets');
        Schema::dropIfExists('copilot_messages');
        Schema::dropIfExists('copilot_chats');
    }
};
