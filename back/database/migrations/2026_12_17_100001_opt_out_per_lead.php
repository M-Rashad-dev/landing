<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * «مش مهتم» stops the reminders of that abandoned cart only (owner, 2026-11-26), not every later cart of the phone:
 * it moves from a per-store phone / email list onto the lead. Existing stops land on the leads they were about.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('abandoned_leads', function (Blueprint $table): void {
            $table->timestamp('opted_out_at')->nullable()->after('recovered_at');
        });

        foreach (DB::table('recovery_opt_outs')->orderBy('id')->get() as $stop) {
            DB::table('abandoned_leads')
                ->where('tenant_id', $stop->tenant_id)->whereNull('opted_out_at')->where('created_at', '<=', $stop->created_at)
                ->where(fn ($q) => $q->when($stop->phone !== null, fn ($w) => $w->orWhere('customer_phone', $stop->phone))->when($stop->email !== null, fn ($w) => $w->orWhere('customer_email', $stop->email)))
                ->update(['opted_out_at' => $stop->created_at]);
        }

        Schema::dropIfExists('recovery_opt_outs');
    }

    public function down(): void
    {
        Schema::create('recovery_opt_outs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('phone', 20)->nullable();
            $table->string('email', 191)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['tenant_id', 'phone']);
            $table->index(['tenant_id', 'email']);
        });
        Schema::table('abandoned_leads', function (Blueprint $table): void {
            $table->dropColumn('opted_out_at');
        });
    }
};
