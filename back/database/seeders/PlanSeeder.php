<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Billing\PlanCatalog;
use App\Enums\BillingPeriod;
use App\Enums\PlanFeature;
use App\Enums\PlanLimit;
use App\Models\Plan;
use App\Models\PlanFeatureValue;
use App\Models\PlanPrice;
use Illuminate\Database\Seeder;

/**
 * The three starting plans (docs/features/3-PLANS.md). Safe on every deploy: creates what is
 * missing and never overwrites prices or values the admin already changed.
 */
class PlanSeeder extends Seeder
{
    /** @var array<string, array{name: string, tagline: string, sort: int, highlighted: bool, monthly: int, yearly: int, values: array<string, int|null>}> */
    public const PLANS = [
        'basic' => [
            'name' => 'بيسك',
            'tagline' => 'الأساسيات عشان تبدأ بصفحات اللاندنج',
            'sort' => 1,
            'highlighted' => false,
            'monthly' => 50,
            'yearly' => 600,
            'values' => [
                'products' => 5, 'landing_pages' => 3, 'custom_domains' => 0, 'media_storage_mb' => 200,
                'offers' => 2, 'discount_codes' => 2, 'webhooks' => 0, 'ab_tests' => 0,
                'upsells' => 0, 'abandoned_leads' => 0, 'advanced_analytics' => 0, 'remove_branding' => 0, 'buy_themes' => 0, 'store' => 0, 'store_categories' => 0,
            ],
        ],
        'pro' => [
            'name' => 'برو',
            'tagline' => 'كل اللي تحتاجه عشان تبيع وتكبر',
            'sort' => 2,
            'highlighted' => true,
            'monthly' => 100,
            'yearly' => 1200,
            'values' => [
                'products' => 20, 'landing_pages' => 20, 'custom_domains' => 1, 'media_storage_mb' => 2000,
                'offers' => 20, 'discount_codes' => 50, 'webhooks' => 3, 'ab_tests' => 1,
                'upsells' => 1, 'abandoned_leads' => 1, 'advanced_analytics' => 1, 'remove_branding' => 0, 'buy_themes' => 1, 'store' => 1, 'store_categories' => 20,
            ],
        ],
        'max' => [
            'name' => 'ماكس',
            'tagline' => 'أعلى حدود وكل الميزات من غير شعار المنصة',
            'sort' => 3,
            'highlighted' => false,
            'monthly' => 150,
            'yearly' => 1800,
            'values' => [
                'products' => 200, 'landing_pages' => null, 'custom_domains' => 5, 'media_storage_mb' => 10000,
                'offers' => null, 'discount_codes' => null, 'webhooks' => 10, 'ab_tests' => 5,
                'upsells' => 1, 'abandoned_leads' => 1, 'advanced_analytics' => 1, 'remove_branding' => 1, 'buy_themes' => 1, 'store' => 1, 'store_categories' => null,
            ],
        ],
    ];

    public function run(): void
    {
        $now = now();
        $plans = $prices = $values = [];

        foreach (self::PLANS as $key => $plan) {
            $plans[] = [
                'key' => $key, 'name' => $plan['name'], 'tagline' => $plan['tagline'], 'sort_order' => $plan['sort'],
                'is_highlighted' => $plan['highlighted'], 'is_public' => true, 'is_archived' => false,
                'created_at' => $now, 'updated_at' => $now,
            ];

            foreach ([BillingPeriod::Monthly->value => $plan['monthly'], BillingPeriod::Yearly->value => $plan['yearly']] as $period => $price) {
                $prices[] = ['plan_key' => $key, 'period' => $period, 'price' => $price, 'discount_percent' => 0, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now];
            }

            // Every known entitlement gets a row, so a feature added later starts closed for old plans.
            foreach ([...PlanFeature::cases(), ...PlanLimit::cases()] as $entitlement) {
                $values[] = ['plan_key' => $key, 'entitlement' => $entitlement->value, 'value' => array_key_exists($entitlement->value, $plan['values']) ? $plan['values'][$entitlement->value] : 0, 'created_at' => $now, 'updated_at' => $now];
            }
        }

        // insertOrIgnore: rows the admin already has (same unique key) are left as they are.
        Plan::query()->insertOrIgnore($plans);
        PlanPrice::query()->insertOrIgnore($prices);
        PlanFeatureValue::query()->insertOrIgnore($values);

        // Bulk inserts fire no model events.
        PlanCatalog::flush();
    }
}
