<?php

declare(strict_types=1);

use App\Auth\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Staff accounts (docs/plans/merchant-essentials.md, stage 1): people the store adds, each with the permissions they
 * are given (spatie/laravel-permission), an invitation link to set their password, the store's activity log, and a
 * plan limit on how many.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('invited_by')->nullable()->after('role')->constrained('users')->nullOnDelete();
            $table->dateTime('invited_at')->nullable()->after('invited_by');
            $table->dateTime('accepted_at')->nullable()->after('invited_at');
            // Over the plan's staff seats after a downgrade: kept, but can't sign in.
            $table->boolean('locked_by_plan')->default(false)->after('is_active');
        });

        Schema::create('staff_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->dateTime('expires_at');
            $table->dateTime('used_at')->nullable();
            $table->timestamps();
        });

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('permission', 60)->nullable();
            $table->string('method', 8);
            $table->string('path', 255);
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('summary', 255);
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'created_at']);
            $table->index(['tenant_id', 'user_id']);
        });

        // Staff seats per plan (the platform owner changes them in the admin).
        $seats = ['basic' => 1, 'pro' => 3, 'max' => 10];
        foreach (DB::table('plans')->pluck('key') as $plan) {
            DB::table('plan_feature_values')->updateOrInsert(
                ['plan_key' => $plan, 'entitlement' => 'staff_accounts'],
                ['value' => $seats[$plan] ?? 1, 'created_at' => now(), 'updated_at' => now()],
            );
        }

        PermissionCatalog::sync();
    }

    public function down(): void
    {
        DB::table('plan_feature_values')->where('entitlement', 'staff_accounts')->delete();
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('staff_invitations');
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invited_by');
            $table->dropColumn(['invited_at', 'accepted_at', 'locked_by_plan']);
        });
    }
};
