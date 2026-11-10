<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * On/off plan features. The admin turns each one on or off per plan; the code enforces it.
 * Store and theme-store features are added with those features (never a key without its check).
 */
enum PlanFeature: string
{
    case Upsells = 'upsells';
    case AbandonedLeads = 'abandoned_leads';
    case AdvancedAnalytics = 'advanced_analytics';
    case RemoveBranding = 'remove_branding';

    public function label(): string
    {
        return match ($this) {
            self::Upsells => 'عروض ما بعد الطلب',
            self::AbandonedLeads => 'الطلبات المتروكة',
            self::AdvancedAnalytics => 'التحليلات المتقدمة',
            self::RemoveBranding => 'إخفاء شعار المنصة من الصفحات',
        };
    }
}
