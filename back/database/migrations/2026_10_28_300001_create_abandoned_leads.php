<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Order forms left after the phone was typed (recoverable by a call or WhatsApp). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('abandoned_leads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('landing_page_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name', 80)->nullable();
            $table->string('customer_phone', 20);
            $table->string('governorate', 60)->nullable();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->string('status', 20)->default('open');
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('contacted_at')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status', 'id']);
            $table->index(['tenant_id', 'customer_phone']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('abandoned_leads');
    }
};
