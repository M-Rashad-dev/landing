<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Automatic blocking (repeated identical orders, too many orders in a day, mostly returned orders):
 * which blocks the rules made, and customers the merchant cleared (never blocked automatically again).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('blocked_customers', function (Blueprint $table) {
            // null = blocked by the merchant; else the rule: same_in_row · per_day · returns
            $table->string('rule', 20)->nullable()->after('reason');
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->boolean('block_exempt')->default(false)->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('customers', fn (Blueprint $table) => $table->dropColumn('block_exempt'));
        Schema::table('blocked_customers', fn (Blueprint $table) => $table->dropColumn('rule'));
    }
};
