<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_design_runs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('chat_id')->constrained('ai_chats')->cascadeOnDelete();
            $table->json('plan')->nullable();
            // queued | images | sections | design | proposed | applied | rejected | failed
            $table->string('status', 20)->default('queued');
            $table->string('progress', 120)->nullable();
            $table->json('image_results')->nullable();
            $table->json('section_ids')->nullable();
            $table->json('proposal')->nullable();
            $table->json('previous_draft')->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->string('error', 300)->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'chat_id']);
        });

        Schema::table('ai_chat_messages', function (Blueprint $table): void {
            $table->foreign('run_id')->references('id')->on('ai_design_runs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('ai_chat_messages', function (Blueprint $table): void {
            $table->dropForeign(['run_id']);
        });

        Schema::dropIfExists('ai_design_runs');
    }
};
