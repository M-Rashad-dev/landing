<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('host', 253)->index();
            $table->string('type', 20);
            $table->string('status', 20)->default('pending');
            $table->boolean('is_primary')->default(false);
            // Equals host only while status = active, otherwise null. Managed in code.
            $table->string('active_host', 253)->nullable()->unique();
            $table->timestamp('verified_at')->nullable();
            $table->unsignedInteger('check_attempts')->default(0);
            $table->timestamp('last_checked_at')->nullable();
            $table->string('last_check_error', 500)->nullable();
            $table->string('ssl_status', 20)->default('pending');
            $table->timestamp('ssl_checked_at')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'type']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('domains');
    }
};
