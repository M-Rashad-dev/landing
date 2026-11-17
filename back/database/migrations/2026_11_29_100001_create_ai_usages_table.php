<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every call to the AI provider and what it cost (App\Ai\Ai writes it). A platform log, read by the
 * super admin only: tenant_id says whose request it was (null = the platform's own, e.g. the
 * knowledge base), and stays as history when a store is deleted. Merchants' own balance and history
 * come later in their own tenant table (AI wallet).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_usages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('feature', 40);
            $table->string('model', 80);
            $table->unsignedInteger('input_tokens')->default(0);
            $table->unsignedInteger('cached_tokens')->default(0);
            $table->unsignedInteger('output_tokens')->default(0);
            $table->decimal('cost_usd', 12, 6)->default(0);
            $table->boolean('ok')->default(true);
            $table->string('error', 300)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('created_at');
            $table->index(['tenant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usages');
    }
};
