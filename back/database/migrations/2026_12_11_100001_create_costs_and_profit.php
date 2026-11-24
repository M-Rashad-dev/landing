<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Costs and profit (docs/plans/merchant-essentials.md, stage 3): what a product costs the store, what shipping and
 * collection really cost it, packaging, and the store's other expenses — snapshotted on each order so later edits
 * never rewrite past profit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->decimal('cost', 12, 2)->nullable()->after('compare_at_price');
        });
        Schema::table('product_variants', function (Blueprint $table) {
            $table->decimal('cost', 12, 2)->nullable()->after('stock');
        });

        Schema::table('shipping_companies', function (Blueprint $table) {
            // What the carrier charges the store (null = the fee the customer pays), a returned parcel, the COD cut.
            $table->decimal('default_cost', 12, 2)->nullable()->after('default_fee');
            $table->decimal('return_cost', 12, 2)->nullable()->after('default_cost');
            $table->decimal('cod_fee_percent', 5, 2)->nullable()->after('return_cost');
        });
        Schema::table('shipping_company_rates', function (Blueprint $table) {
            $table->decimal('cost', 12, 2)->nullable()->after('fee');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 12, 2)->nullable()->after('unit_price');
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('shipping_cost', 12, 2)->nullable()->after('shipping_fee');
            $table->decimal('return_cost', 12, 2)->nullable()->after('shipping_cost');
            $table->decimal('cod_fee', 12, 2)->nullable()->after('return_cost');
            $table->decimal('packaging_cost', 12, 2)->nullable()->after('cod_fee');
        });

        Schema::create('profit_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('packaging_cost', 12, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->date('spent_on');
            $table->string('kind', 20);
            $table->decimal('amount', 12, 2);
            $table->string('note', 200)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'spent_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('profit_settings');
        Schema::table('orders', fn (Blueprint $t) => $t->dropColumn(['shipping_cost', 'return_cost', 'cod_fee', 'packaging_cost']));
        Schema::table('order_items', fn (Blueprint $t) => $t->dropColumn('unit_cost'));
        Schema::table('shipping_company_rates', fn (Blueprint $t) => $t->dropColumn('cost'));
        Schema::table('shipping_companies', fn (Blueprint $t) => $t->dropColumn(['default_cost', 'return_cost', 'cod_fee_percent']));
        Schema::table('product_variants', fn (Blueprint $t) => $t->dropColumn('cost'));
        Schema::table('products', fn (Blueprint $t) => $t->dropColumn('cost'));
    }
};
