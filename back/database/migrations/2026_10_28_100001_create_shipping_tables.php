<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Delivery fees per governorate (store-wide) and the fee charged on each order. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(false);
            $table->decimal('default_fee', 12, 2)->default(0);
            $table->decimal('free_over', 12, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('shipping_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('governorate', 60);
            // Null fee → the default fee.
            $table->decimal('fee', 12, 2)->nullable();
            $table->boolean('is_available')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'governorate']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->decimal('shipping_fee', 12, 2)->default(0)->after('code_discount');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('shipping_fee');
        });
        Schema::dropIfExists('shipping_rates');
        Schema::dropIfExists('shipping_settings');
    }
};
