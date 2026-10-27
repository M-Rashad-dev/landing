<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 60);
            $table->string('target_type', 40);
            $table->string('target_id', 60);
            $table->json('meta')->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['target_type', 'target_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
    }
};
