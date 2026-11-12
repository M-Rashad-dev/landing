<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An optional email from the store checkout and the customer's account: the store can send order
 * news and offers to customers who gave one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('customer_email', 191)->nullable()->after('customer_phone2');
        });
        Schema::table('customers', function (Blueprint $table) {
            $table->string('email', 191)->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('orders', fn (Blueprint $table) => $table->dropColumn('customer_email'));
        Schema::table('customers', fn (Blueprint $table) => $table->dropColumn('email'));
    }
};
