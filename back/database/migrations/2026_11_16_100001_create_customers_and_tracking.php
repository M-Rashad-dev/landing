<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Customers (one per phone per store; future storefront accounts attach to the same row),
 * the shipment tracking number on orders, and abandoned carts (a cart token, the phone may be unknown).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('phone', 20);
            $table->string('name', 80)->nullable();
            $table->string('governorate', 60)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('address', 300)->nullable();
            $table->text('note')->nullable();
            $table->timestamp('first_order_at')->nullable();
            $table->timestamp('last_order_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'phone']);
            $table->index(['tenant_id', 'last_order_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('customer_id')->nullable()->after('tenant_id')->constrained()->nullOnDelete();
            $table->string('tracking_number', 60)->nullable()->after('shipping_discount');
        });

        Schema::table('abandoned_leads', function (Blueprint $table) {
            $table->string('customer_phone', 20)->nullable()->change();
            $table->string('cart_token', 64)->nullable()->after('cart');
            $table->index(['tenant_id', 'cart_token']);
        });

        $this->backfill();
    }

    /** One customer per phone from the existing orders (details of the latest order). */
    private function backfill(): void
    {
        $now = now();
        $groups = DB::table('orders')
            ->select('tenant_id', 'customer_phone', DB::raw('min(created_at) as first_at'), DB::raw('max(created_at) as last_at'), DB::raw('max(id) as last_id'))
            ->groupBy('tenant_id', 'customer_phone')
            ->orderBy('tenant_id');

        $groups->chunk(500, function ($rows) use ($now): void {
            foreach ($rows as $row) {
                $last = DB::table('orders')->where('id', $row->last_id)->first(['customer_name', 'governorate', 'city', 'address']);
                $id = DB::table('customers')->insertGetId([
                    'tenant_id' => $row->tenant_id,
                    'phone' => $row->customer_phone,
                    'name' => $last?->customer_name,
                    'governorate' => $last?->governorate,
                    'city' => $last?->city,
                    'address' => $last?->address,
                    'first_order_at' => $row->first_at,
                    'last_order_at' => $row->last_at,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                DB::table('orders')->where('tenant_id', $row->tenant_id)->where('customer_phone', $row->customer_phone)->update(['customer_id' => $id]);
            }
        });
    }

    public function down(): void
    {
        DB::table('abandoned_leads')->whereNull('customer_phone')->delete();
        Schema::table('abandoned_leads', function (Blueprint $table) {
            $table->dropIndex(['tenant_id', 'cart_token']);
            $table->dropColumn('cart_token');
            $table->string('customer_phone', 20)->nullable(false)->change();
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_id');
            $table->dropColumn('tracking_number');
        });
        Schema::dropIfExists('customers');
    }
};
