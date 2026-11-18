<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ai_usages', function (Blueprint $table): void {
            $table->unsignedInteger('images')->default(0)->after('output_tokens');
        });
    }

    public function down(): void
    {
        Schema::table('ai_usages', function (Blueprint $table): void {
            $table->dropColumn('images');
        });
    }
};
