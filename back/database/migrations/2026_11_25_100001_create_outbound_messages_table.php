<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every message the platform sends on WhatsApp (sign-in codes, notifications, auto replies):
 * who, why, which template, and what Meta reported back (sent → delivered → read, or failed).
 * Never the text or the code itself. A platform table (the admin sees all), tenant_id is a label.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('outbound_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel', 16);
            $table->string('recipient', 20);
            $table->string('purpose', 40);
            $table->string('template', 64)->nullable();
            $table->string('provider_id', 128)->nullable()->unique();
            $table->string('status', 16);
            $table->string('error_code', 16)->nullable();
            $table->string('error_title', 255)->nullable();
            $table->dateTime('sent_at')->nullable();
            $table->dateTime('delivered_at')->nullable();
            $table->dateTime('read_at')->nullable();
            $table->dateTime('failed_at')->nullable();
            $table->timestamps();

            $table->index(['recipient', 'id']);
            $table->index(['created_at']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('outbound_messages');
    }
};
