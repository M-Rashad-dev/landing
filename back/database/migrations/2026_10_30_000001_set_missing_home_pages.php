<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Stores that published pages before auto-home existed get their earliest published page as home. */
return new class extends Migration
{
    public function up(): void
    {
        $withHome = DB::table('landing_pages')->where('home_key', 1)->whereNull('deleted_at')->pluck('tenant_id')->all();

        $firsts = DB::table('landing_pages')
            ->select('tenant_id', DB::raw('min(id) as id'))
            ->where('status', 'published')
            ->whereNull('deleted_at')
            ->whereNotIn('tenant_id', $withHome)
            ->groupBy('tenant_id')
            ->pluck('id')
            ->all();

        if ($firsts !== []) {
            DB::table('landing_pages')->whereIn('id', $firsts)->update(['is_home' => true, 'home_key' => 1]);
        }
    }

    public function down(): void
    {
        // Data fix only; nothing to undo.
    }
};
