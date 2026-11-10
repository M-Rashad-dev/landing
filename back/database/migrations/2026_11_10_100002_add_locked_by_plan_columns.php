<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rows above a plan limit after a downgrade: kept, shown with a lock in the dashboard, not
 * served to visitors (PlanLocks). Separate from the merchant's own status columns.
 */
return new class extends Migration
{
    private const TABLES = ['products', 'landing_pages', 'domains', 'offers', 'discount_codes', 'webhooks', 'ab_tests'];

    public function up(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->boolean('locked_by_plan')->default(false);
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropColumn('locked_by_plan');
            });
        }
    }
};
