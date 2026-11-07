<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Orders are reported to ad pixels as Purchase (with value + currency) by default: Lead carries
 * no value, so Ads Manager showed no revenue or ROAS. Existing identities switch to Purchase.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('identities')->select(['id', 'tracking'])->orderBy('id')->each(function (object $row): void {
            $tracking = json_decode((string) $row->tracking, true);
            $tracking = is_array($tracking) ? $tracking : [];
            if (($tracking['conversion_event'] ?? null) === 'Purchase') {
                return;
            }
            $tracking['conversion_event'] = 'Purchase';
            DB::table('identities')->where('id', $row->id)->update(['tracking' => json_encode($tracking)]);
        });
    }

    public function down(): void
    {
        // Data change only; merchants can pick Lead again from the identity settings.
    }
};
