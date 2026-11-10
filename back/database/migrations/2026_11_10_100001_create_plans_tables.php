<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Plans (platform tables, edited by the super admin) and subscriptions (tenant tables).
 * The tenant row keeps a copy of its running plan so every request reads access from one row.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->string('key', 40)->primary();
            $table->string('name', 60);
            $table->string('tagline', 150)->nullable();
            $table->text('description')->nullable();
            // Extra selling points on the pricing card, on top of the limits table.
            $table->json('marketing_points')->nullable();
            $table->boolean('is_public')->default(true);
            $table->boolean('is_highlighted')->default(false);
            $table->boolean('is_archived')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('plan_prices', function (Blueprint $table) {
            $table->id();
            $table->string('plan_key', 40);
            $table->string('period', 20);
            $table->decimal('price', 12, 2);
            $table->unsignedTinyInteger('discount_percent')->default(0);
            $table->timestamp('discount_starts_at')->nullable();
            $table->timestamp('discount_ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('plan_key')->references('key')->on('plans')->cascadeOnUpdate()->restrictOnDelete();
            $table->unique(['plan_key', 'period']);
        });

        Schema::create('plan_feature_values', function (Blueprint $table) {
            $table->id();
            $table->string('plan_key', 40);
            // PlanFeature or PlanLimit value.
            $table->string('entitlement', 40);
            // Features: 0 / 1. Limits: a number, null = unlimited (up to the safety cap).
            $table->unsignedInteger('value')->nullable();
            $table->timestamps();

            $table->foreign('plan_key')->references('key')->on('plans')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unique(['plan_key', 'entitlement']);
        });

        Schema::create('platform_settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->json('value')->nullable();
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('plan_key', 40);
            $table->string('period', 20)->nullable();
            $table->string('source', 20);
            $table->string('status', 20)->default('active');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            // What was actually paid for this row (0 for trials and admin grants).
            $table->decimal('amount_paid', 12, 2)->default(0);
            $table->string('currency', 3)->default('EGP');
            // Snapshot of the plan and price at purchase time.
            $table->json('snapshot')->nullable();
            $table->string('note', 500)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('refunded_at')->nullable();
            $table->timestamps();

            $table->foreign('plan_key')->references('key')->on('plans')->cascadeOnUpdate()->restrictOnDelete();
            $table->index(['tenant_id', 'status', 'starts_at']);
            $table->index(['tenant_id', 'refunded_at']);
        });

        Schema::create('entitlement_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('entitlement', 40);
            $table->unsignedInteger('value')->nullable();
            $table->string('reason', 300);
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'entitlement']);
        });

        Schema::table('tenants', function (Blueprint $table) {
            // Copy of the running subscription (SubscriptionManager::sync keeps it right).
            $table->string('plan_key', 40)->nullable()->after('settings');
            $table->string('plan_period', 20)->nullable()->after('plan_key');
            $table->string('plan_source', 20)->nullable()->after('plan_period');
            $table->timestamp('plan_ends_at')->nullable()->after('plan_source');
            $table->timestamp('plan_grace_ends_at')->nullable()->after('plan_ends_at');
            // Next moment the plan state changes (period end, grace end, a queued row starts).
            $table->timestamp('plan_next_check_at')->nullable()->after('plan_grace_ends_at');
            // Access state as of the last sync: tells the sync when open / closed flipped.
            $table->string('plan_state', 10)->default('closed')->after('plan_next_check_at');
            $table->boolean('trial_used')->default(false)->after('plan_state');

            $table->index('plan_next_check_at');
            $table->index(['plan_key', 'plan_ends_at']);
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropIndex(['plan_next_check_at']);
            $table->dropIndex(['plan_key', 'plan_ends_at']);
            $table->dropColumn(['plan_key', 'plan_period', 'plan_source', 'plan_ends_at', 'plan_grace_ends_at', 'plan_next_check_at', 'plan_state', 'trial_used']);
        });
        Schema::dropIfExists('entitlement_overrides');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('platform_settings');
        Schema::dropIfExists('plan_feature_values');
        Schema::dropIfExists('plan_prices');
        Schema::dropIfExists('plans');
    }
};
