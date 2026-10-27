<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Order lists sort by order_number (per tenant). These indexes end with order_number so each
 * filter (status, page, duplicates) reads only the 20 rows it shows. Measured with ANALYZE on
 * 78k orders / 20 tenants (DECISIONS.md, phase 11).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index(['tenant_id', 'status', 'order_number']);
            $table->index(['tenant_id', 'landing_page_id', 'order_number']);
            $table->index(['tenant_id', 'is_duplicate_suspect', 'order_number']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'status', 'created_at']);
            $table->dropIndex(['tenant_id', 'landing_page_id']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->index(['tenant_id', 'status', 'created_at']);
            $table->index(['tenant_id', 'landing_page_id']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'status', 'order_number']);
            $table->dropIndex(['tenant_id', 'landing_page_id', 'order_number']);
            $table->dropIndex(['tenant_id', 'is_duplicate_suspect', 'order_number']);
        });
    }
};
