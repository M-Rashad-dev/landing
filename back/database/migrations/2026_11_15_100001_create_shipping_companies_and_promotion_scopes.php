<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shipping companies (each with its own fee per governorate), shipping offers (free / cheaper
 * delivery on conditions), and offers / codes that target all products, products or categories.
 * The old store-wide fee becomes the first company and the old "free over" becomes a shipping offer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipping_companies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->foreignId('media_id')->nullable()->constrained('media')->nullOnDelete();
            $table->unsignedTinyInteger('delivery_days_min')->nullable();
            $table->unsignedTinyInteger('delivery_days_max')->nullable();
            $table->decimal('default_fee', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            $table->index(['tenant_id', 'is_active', 'position']);
        });

        Schema::create('shipping_company_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shipping_company_id')->constrained()->cascadeOnDelete();
            $table->string('governorate', 60);
            // Null fee → the company's default fee.
            $table->decimal('fee', 12, 2)->nullable();
            $table->boolean('is_available')->default(true);
            $table->timestamps();

            $table->unique(['shipping_company_id', 'governorate']);
        });

        Schema::create('shipping_offers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            // free · discount (amount off the fee) · flat (the customer pays this fee)
            $table->string('benefit', 20);
            $table->decimal('value', 12, 2)->nullable();
            $table->unsignedSmallInteger('min_quantity')->nullable();
            $table->decimal('min_total', 12, 2)->nullable();
            // all · products · categories
            $table->string('applies_to', 20)->default('all');
            // Null = every governorate / every company.
            $table->json('governorates')->nullable();
            $table->json('company_ids')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['tenant_id', 'is_active', 'starts_at', 'ends_at']);
        });

        Schema::create('shipping_offer_products', function (Blueprint $table) {
            $table->foreignId('shipping_offer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->primary(['shipping_offer_id', 'product_id']);
            $table->index('product_id');
        });

        Schema::create('shipping_offer_categories', function (Blueprint $table) {
            $table->foreignId('shipping_offer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->primary(['shipping_offer_id', 'category_id']);
            $table->index('category_id');
        });

        Schema::create('offer_categories', function (Blueprint $table) {
            $table->foreignId('offer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->primary(['offer_id', 'category_id']);
            $table->index('category_id');
        });

        Schema::create('discount_code_categories', function (Blueprint $table) {
            $table->foreignId('discount_code_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->primary(['discount_code_id', 'category_id']);
            $table->index('category_id');
        });

        Schema::table('offers', function (Blueprint $table) {
            $table->string('applies_to', 20)->default('products')->after('type');
        });

        Schema::table('discount_codes', function (Blueprint $table) {
            $table->string('applies_to', 20)->default('all')->after('type');
            $table->unsignedSmallInteger('min_quantity')->nullable()->after('min_order_total');
            $table->boolean('first_order_only')->default(false)->after('usage_limit_per_phone');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->unsignedBigInteger('shipping_company_id')->nullable()->after('shipping_fee');
            $table->string('shipping_company_name', 60)->nullable()->after('shipping_company_id');
            $table->string('shipping_offer_name', 100)->nullable()->after('shipping_company_name');
            $table->decimal('shipping_discount', 12, 2)->default(0)->after('shipping_offer_name');
        });

        // Codes that were limited to products keep that limit.
        DB::table('discount_codes')
            ->whereIn('id', DB::table('discount_code_products')->select('discount_code_id'))
            ->update(['applies_to' => 'products']);

        $this->moveOldFees();

        Schema::drop('shipping_rates');
        Schema::table('shipping_settings', function (Blueprint $table) {
            $table->dropColumn(['default_fee', 'free_over']);
        });
    }

    /** Each store's old default fee + per-governorate rows → one company; "free over" → a shipping offer. */
    private function moveOldFees(): void
    {
        $now = now();
        $tenants = DB::table('shipping_settings')->pluck('tenant_id')
            ->merge(DB::table('shipping_rates')->distinct()->pluck('tenant_id'))
            ->unique();

        foreach ($tenants as $tenantId) {
            $settings = DB::table('shipping_settings')->where('tenant_id', $tenantId)->first();
            $companyId = DB::table('shipping_companies')->insertGetId([
                'tenant_id' => $tenantId,
                'name' => 'التوصيل',
                'default_fee' => $settings->default_fee ?? '0.00',
                'is_active' => true,
                'position' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach (DB::table('shipping_rates')->where('tenant_id', $tenantId)->get() as $rate) {
                DB::table('shipping_company_rates')->insert([
                    'tenant_id' => $tenantId,
                    'shipping_company_id' => $companyId,
                    'governorate' => $rate->governorate,
                    'fee' => $rate->fee,
                    'is_available' => $rate->is_available,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            if ($settings !== null && $settings->free_over !== null) {
                DB::table('shipping_offers')->insert([
                    'tenant_id' => $tenantId,
                    'name' => 'شحن مجاني فوق '.rtrim(rtrim((string) $settings->free_over, '0'), '.').' جنيه',
                    'benefit' => 'free',
                    'min_total' => $settings->free_over,
                    'applies_to' => 'all',
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('shipping_settings', function (Blueprint $table) {
            $table->decimal('default_fee', 12, 2)->default(0);
            $table->decimal('free_over', 12, 2)->nullable();
        });
        Schema::create('shipping_rates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('governorate', 60);
            $table->decimal('fee', 12, 2)->nullable();
            $table->boolean('is_available')->default(true);
            $table->timestamps();
            $table->unique(['tenant_id', 'governorate']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['shipping_company_id', 'shipping_company_name', 'shipping_offer_name', 'shipping_discount']);
        });
        Schema::table('discount_codes', function (Blueprint $table) {
            $table->dropColumn(['applies_to', 'min_quantity', 'first_order_only']);
        });
        Schema::table('offers', function (Blueprint $table) {
            $table->dropColumn('applies_to');
        });
        Schema::dropIfExists('discount_code_categories');
        Schema::dropIfExists('offer_categories');
        Schema::dropIfExists('shipping_offer_categories');
        Schema::dropIfExists('shipping_offer_products');
        Schema::dropIfExists('shipping_offers');
        Schema::dropIfExists('shipping_company_rates');
        Schema::dropIfExists('shipping_companies');
    }
};
