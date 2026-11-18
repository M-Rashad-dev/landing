<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI designer foundation (docs/plans/ai-designer.md §3.1): a store's own AI sections for one theme
 * («أقسامي»), the chats that make / edit them, and every design version the AI proposed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_sections', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            // store | landing
            $table->string('kind', 10);
            $table->string('theme_key', 60);
            $table->string('name', 100);
            $table->unsignedBigInteger('current_version_id')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'kind', 'theme_key']);
        });

        Schema::create('ai_chats', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);
            $table->string('theme_key', 60);
            $table->foreignId('landing_page_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'kind', 'theme_key']);
        });

        Schema::create('ai_section_versions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chat_id')->nullable()->constrained('ai_chats')->nullOnDelete();
            $table->foreignId('ai_section_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            // The sanitized template, the AI's own CSS (given back on edits) and the scoped CSS pages use.
            $table->mediumText('html');
            $table->mediumText('css_raw');
            $table->mediumText('css');
            $table->json('fields');
            // proposed | approved | rejected | replaced
            $table->string('status', 10)->default('proposed');
            $table->timestamp('decided_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::table('ai_sections', function (Blueprint $table): void {
            $table->foreign('current_version_id')->references('id')->on('ai_section_versions')->nullOnDelete();
        });

        Schema::create('ai_chat_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chat_id')->constrained('ai_chats')->cascadeOnDelete();
            // user | assistant
            $table->string('role', 10);
            $table->text('text')->nullable();
            $table->json('media_ids')->nullable();
            $table->foreignId('focus_section_id')->nullable()->constrained('ai_sections')->nullOnDelete();
            // pending | done | failed
            $table->string('status', 10)->default('done');
            $table->foreignId('version_id')->nullable()->constrained('ai_section_versions')->nullOnDelete();
            $table->unsignedBigInteger('run_id')->nullable();
            $table->json('plan')->nullable();
            $table->foreignId('ai_usage_id')->nullable()->constrained()->nullOnDelete();
            $table->string('error', 300)->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('ai_sections', function (Blueprint $table): void {
            $table->dropForeign(['current_version_id']);
        });
        Schema::dropIfExists('ai_chat_messages');
        Schema::dropIfExists('ai_section_versions');
        Schema::dropIfExists('ai_chats');
        Schema::dropIfExists('ai_sections');
    }
};
