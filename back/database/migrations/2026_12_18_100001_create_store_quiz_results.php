<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * «اختبار البشرة»: how many visitors got each result, per day (counts only, nothing about the visitor).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('store_quiz_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            // The quiz section of the store's design and the result the visitor got.
            $table->string('section_id', 40);
            $table->string('result_id', 12);
            $table->date('date');
            $table->unsignedInteger('count')->default(0);

            $table->unique(['tenant_id', 'section_id', 'result_id', 'date'], 'store_quiz_results_day');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('store_quiz_results');
    }
};
