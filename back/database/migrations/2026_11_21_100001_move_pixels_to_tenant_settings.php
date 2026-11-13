<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Owner decision (Nov 2026): pixels are set once, one set for the store and one set every
 * landing page listens to (tenants.settings.pixels). The ids of each store's default identity
 * become both, with the landing pages following the store; per-page overrides go away.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('identities')->where('is_default', true)->whereNotNull('tracking')->get(['tenant_id', 'tracking']) as $identity) {
            $tracking = json_decode((string) $identity->tracking, true);
            if (! is_array($tracking) || array_filter($tracking, fn ($v) => is_string($v) && $v !== '' && $v !== 'Purchase' && $v !== 'Lead') === []) {
                continue;
            }
            $tenant = DB::table('tenants')->where('id', $identity->tenant_id)->first(['id', 'settings']);
            if ($tenant === null) {
                continue;
            }
            $settings = json_decode((string) $tenant->settings, true);
            $settings = is_array($settings) ? $settings : [];
            if (isset($settings['pixels'])) {
                continue;
            }
            $settings['pixels'] = ['store' => $tracking, 'landing' => ['conversion_event' => $tracking['conversion_event'] ?? 'Purchase'], 'landing_same' => true];
            DB::table('tenants')->where('id', $tenant->id)->update(['settings' => json_encode($settings, JSON_UNESCAPED_UNICODE)]);
        }

        Schema::table('landing_pages', function (Blueprint $table): void {
            $table->dropColumn('tracking_override');
        });
    }

    public function down(): void
    {
        Schema::table('landing_pages', function (Blueprint $table): void {
            $table->json('tracking_override')->nullable();
        });
    }
};
