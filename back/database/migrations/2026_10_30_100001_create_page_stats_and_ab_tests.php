<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Per-page analytics (daily counters) and A/B tests between two whole pages. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ab_tests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->foreignId('page_a_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->foreignId('page_b_id')->constrained('landing_pages')->cascadeOnDelete();
            $table->unsignedTinyInteger('split_a')->default(50);
            $table->string('status', 20)->default('running');
            $table->foreignId('winner_page_id')->nullable()->constrained('landing_pages')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
        });

        // One row per page / test / day / source / device; ab_test_id 0 = outside any test.
        Schema::create('page_stats', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('ab_test_id')->default(0);
            $table->date('date');
            $table->string('source', 20);
            $table->string('device', 10);
            $table->unsignedInteger('views')->default(0);
            $table->unsignedInteger('form_starts')->default(0);

            $table->unique(['landing_page_id', 'ab_test_id', 'date', 'source', 'device'], 'page_stats_bucket');
            $table->index(['tenant_id', 'date']);
            $table->index(['ab_test_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('ab_test_id')->nullable()->after('landing_page_id')->constrained('ab_tests')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('ab_test_id');
        });
        Schema::dropIfExists('page_stats');
        Schema::dropIfExists('ab_tests');
    }
};
