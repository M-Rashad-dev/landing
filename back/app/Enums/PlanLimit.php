<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Numeric plan limits. The admin sets the value per plan (null = unlimited); the
 * code below is what enforces each one, so a key exists only when its check exists.
 */
enum PlanLimit: string
{
    case Products = 'products';
    case LandingPages = 'landing_pages';
    case CustomDomains = 'custom_domains';
    case MediaStorageMb = 'media_storage_mb';
    case Offers = 'offers';
    case DiscountCodes = 'discount_codes';
    case Webhooks = 'webhooks';
    case AbTests = 'ab_tests';
    case StoreCategories = 'store_categories';

    public function label(): string
    {
        return match ($this) {
            self::Products => 'المنتجات',
            self::LandingPages => 'صفحات اللاندنج',
            self::CustomDomains => 'الدومينات الخارجية',
            self::MediaStorageMb => 'مساحة الوسائط (ميجابايت)',
            self::Offers => 'العروض',
            self::DiscountCodes => 'أكواد الخصم',
            self::Webhooks => 'الربط (Webhooks و Google Sheets)',
            self::AbTests => 'اختبارات A/B الشغالة',
            self::StoreCategories => 'تصنيفات المتجر',
        };
    }

    /**
     * Platform safety ceiling above every plan (even "unlimited"), from config/landing.php.
     */
    public function safetyCap(): int
    {
        return (int) config('landing.limits.'.match ($this) {
            self::Products => 'products',
            self::LandingPages => 'pages',
            self::CustomDomains => 'custom_domains',
            self::MediaStorageMb => 'media_storage_mb',
            self::Offers => 'offers',
            self::DiscountCodes => 'discount_codes',
            self::Webhooks => 'webhooks',
            self::AbTests => 'ab_tests',
            self::StoreCategories => 'store_categories',
        });
    }

    /** Over-limit rows of these limits are kept but stop serving (locked_by_plan) after a downgrade. */
    public function locksRows(): bool
    {
        return $this !== self::MediaStorageMb;
    }
}
