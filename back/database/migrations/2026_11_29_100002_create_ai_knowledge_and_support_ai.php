<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The support assistant: the knowledge base the owner writes in the admin (platform tables, no
 * tenant), cut into chunks with their vectors; and on conversations, who handles it now (the
 * assistant or people: one way only) with why and a summary when it moved to people.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_articles', function (Blueprint $table): void {
            $table->id();
            $table->string('title', 160);
            $table->string('category', 30);
            $table->text('body');
            $table->boolean('is_active')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('embedded_at')->nullable();
            $table->string('embed_error', 300)->nullable();
            $table->timestamps();

            $table->index(['is_active', 'category']);
        });

        Schema::create('ai_article_chunks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ai_article_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->text('text');
            // The vector (floats) and the model that made it: a new model means new vectors.
            $table->json('embedding')->nullable();
            $table->string('model', 80)->nullable();
            $table->timestamps();
        });

        Schema::table('support_tickets', function (Blueprint $table): void {
            // ai = the assistant answers; human = people (also every conversation before the assistant).
            $table->string('handler', 10)->default('human')->after('status');
            $table->string('handoff_reason', 20)->nullable()->after('handler');
            $table->text('handoff_summary')->nullable()->after('handoff_reason');
            $table->timestamp('handed_off_at')->nullable()->after('handoff_summary');
            // The assistant's replies that said it couldn't help, in a row (two → people).
            $table->unsignedTinyInteger('ai_misses')->default(0)->after('handed_off_at');

            $table->index(['handler', 'status']);
        });

        Schema::table('support_messages', function (Blueprint $table): void {
            // The knowledge-base articles an assistant reply leaned on (shown to support only).
            $table->json('sources')->nullable()->after('body');
        });
    }

    public function down(): void
    {
        Schema::table('support_messages', fn (Blueprint $table) => $table->dropColumn('sources'));
        Schema::table('support_tickets', function (Blueprint $table): void {
            $table->dropIndex(['handler', 'status']);
            $table->dropColumn(['handler', 'handoff_reason', 'handoff_summary', 'handed_off_at', 'ai_misses']);
        });
        Schema::dropIfExists('ai_article_chunks');
        Schema::dropIfExists('ai_articles');
    }
};
