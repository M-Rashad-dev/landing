<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * On/off plan features. The admin turns each one on or off per plan; the code enforces it.
 * Every key here is enforced in the code (never a key without its check).
 */
enum PlanFeature: string
{
    case Upsells = 'upsells';
    case AbandonedLeads = 'abandoned_leads';
    case AdvancedAnalytics = 'advanced_analytics';
    case RemoveBranding = 'remove_branding';
    case BuyThemes = 'buy_themes';
    case Store = 'store';

    public function label(): string
    {
        return match ($this) {
            self::Upsells => 'عروض ما بعد الطلب',
            self::AbandonedLeads => 'الطلبات المتروكة',
            self::AdvancedAnalytics => 'التحليلات المتقدمة',
            self::RemoveBranding => 'إخفاء شعار المنصة من الصفحات',
            self::BuyThemes => 'شراء واستخدام الثيمات المدفوعة',
            self::Store => 'متجر إلكتروني كامل',
        };
    }
}
