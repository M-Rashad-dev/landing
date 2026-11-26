<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Order messages go on WhatsApp to every order's phone (email only when WhatsApp can't): the order's opt-in and the
 * customer's channel choice are gone.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('whatsapp_opt_in');
        });
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropColumn('notify_channel');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->boolean('whatsapp_opt_in')->default(false);
        });
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('notify_channel', 10)->nullable();
        });
    }
};
