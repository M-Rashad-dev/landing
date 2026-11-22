<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Shipping carriers (docs/plans/shipping-carriers.md): a store's connection to a carrier (its own account today, a
 * platform contract later), the shipments sent through it with their timeline, and how checkout picks a company.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('carrier_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            // The carrier class key (bosta, …).
            $table->string('carrier', 30);
            // own = the merchant's account; platform = a contract of the platform (later).
            $table->string('mode', 10)->default('own');
            // Encrypted JSON (the API key…); never sent to the browser.
            $table->text('credentials')->nullable();
            // The webhook address part (unique platform-wide, unguessable) and the secret the carrier sends back.
            $table->string('webhook_token', 40)->unique();
            $table->text('webhook_secret');
            // Pickup location, open package, package type / size, label size, auto-ship…
            $table->json('settings')->nullable();
            // What the carrier says the account is (business name), shown on the card.
            $table->string('account_name', 120)->nullable();
            // active | failed (the key stopped working)
            $table->string('status', 10)->default('active');
            $table->string('last_error', 300)->nullable();
            $table->timestamp('checked_at')->nullable();
            $table->timestamps();
            $table->unique(['tenant_id', 'carrier']);
        });

        Schema::table('shipping_companies', function (Blueprint $table): void {
            // The carrier account this company ships through (null = shipped by hand).
            $table->foreignId('carrier_account_id')->nullable()->after('media_id')->constrained()->nullOnDelete();
        });

        Schema::table('shipping_settings', function (Blueprint $table): void {
            // customer = the customer picks at checkout; governorate = the store's default company per governorate.
            $table->string('company_choice', 12)->default('customer')->after('enabled');
            // {governorate: shipping_company_id}
            $table->json('governorate_companies')->nullable()->after('company_choice');
        });

        Schema::create('shipments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('carrier_account_id')->nullable()->constrained()->nullOnDelete();
            $table->string('carrier', 30);
            $table->string('external_id', 80)->nullable();
            $table->string('tracking_number', 60);
            // created | picked_up | in_transit | out_for_delivery | delivered | returning | returned | exception
            // | cancelled | lost | damaged
            $table->string('state', 20);
            $table->unsignedSmallInteger('carrier_code')->nullable();
            $table->string('carrier_label', 80)->nullable();
            $table->decimal('cod', 12, 2)->default(0);
            $table->string('exception', 200)->nullable();
            $table->unsignedTinyInteger('attempts')->default(0);
            // Whether the shipment still moves (not delivered, returned, cancelled, lost or damaged).
            $table->boolean('is_open')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'order_id']);
            $table->index(['tenant_id', 'is_open', 'synced_at']);
            $table->index(['carrier', 'tracking_number']);
        });

        Schema::create('shipment_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->string('state', 20);
            $table->unsignedSmallInteger('carrier_code')->nullable();
            $table->string('label', 120)->nullable();
            $table->string('note', 200)->nullable();
            $table->timestamp('happened_at');
            $table->timestamp('created_at')->nullable();
            $table->index(['shipment_id', 'happened_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipment_events');
        Schema::dropIfExists('shipments');
        Schema::table('shipping_settings', function (Blueprint $table): void {
            $table->dropColumn(['company_choice', 'governorate_companies']);
        });
        Schema::table('shipping_companies', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('carrier_account_id');
        });
        Schema::dropIfExists('carrier_accounts');
    }
};
