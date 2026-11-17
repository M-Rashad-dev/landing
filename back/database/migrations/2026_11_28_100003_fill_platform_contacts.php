<?php

declare(strict_types=1);

use App\Billing\PlatformSettings;
use App\Models\PlatformSetting;
use Illuminate\Database\Migrations\Migration;

/**
 * The platform's contacts the owner gave (2026-11-17) for the platform site's footer and WhatsApp
 * button, written once (they replace older values, at the owner's request). The admin edits them
 * later in «الباقات» → «التجربة والفواتير».
 */
return new class extends Migration
{
    private const CONTACTS = [
        'support_email' => 'support@mksab.store',
        'support_whatsapp' => '01094062024',
        'support_phone' => '01094062024',
        'support_address' => 'مصر - الشرقية - العاشر من رمضان',
    ];

    public function up(): void
    {
        foreach (self::CONTACTS as $key => $value) {
            PlatformSetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }
        PlatformSettings::flush();
    }

    public function down(): void
    {
        // The contacts stay: they are the admin's settings from now on.
    }
};
