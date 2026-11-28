<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «أسئلة العملاء» (docs/plans/tekno/PLAN.md §3): a visitor asks about a product from its page, the merchant answers in
 * the dashboard, and an answered question shows on the page once he publishes it. The phone (optional) is for the
 * merchant only. The store's switch turns the questions off on every product page.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('phone', 20)->nullable();
            $table->string('question', 500);
            $table->text('answer')->nullable();
            $table->timestamp('answered_at')->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamps();

            // The product page reads its published answers; the dashboard lists the unanswered first.
            $table->index(['tenant_id', 'product_id', 'is_published']);
            $table->index(['tenant_id', 'answered_at']);
        });

        Schema::table('stores', function (Blueprint $table) {
            $table->boolean('questions_enabled')->default(true)->after('is_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('stores', function (Blueprint $table) {
            $table->dropColumn('questions_enabled');
        });
        Schema::dropIfExists('product_questions');
    }
};
