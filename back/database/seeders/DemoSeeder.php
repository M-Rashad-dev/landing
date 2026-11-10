<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\Auth\RegisterTenant;
use App\Actions\Orders\ChangeOrderStatus;
use App\Actions\Orders\CreateOrder;
use App\Actions\Pages\CreatePage;
use App\Actions\Pages\PageLifecycle;
use App\Actions\Pages\PublishPage;
use App\Actions\Products\SaveProduct;
use App\Actions\Promotions\SaveDiscountCode;
use App\Actions\Promotions\SaveOffer;
use App\Billing\SubscriptionManager;
use App\Billing\Themes\ThemeAccess;
use App\Enums\DiscountType;
use App\Enums\OfferType;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\FormToken;
use App\Tenancy\Tenancy;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Local demo data (never in production): a store with a product, an offer, a code, two published
 * pages (one per theme), orders in every status over the last two weeks, and a super admin.
 * Built through the real actions, so it follows the same rules as data entered in the dashboard.
 */
final class DemoSeeder extends Seeder
{
    public const OWNER_EMAIL = 'demo@example.com';

    public const ADMIN_EMAIL = 'admin@example.com';

    public const PASSWORD = 'demo-pass-123';

    private const CUSTOMERS = [
        ['أحمد محمود', '01001234501', 'القاهرة', 'مدينة نصر', '12 شارع عباس العقاد'],
        ['منى السيد', '01101234502', 'الجيزة', 'الدقي', '5 شارع التحرير'],
        ['محمد علي', '01201234503', 'الإسكندرية', 'سموحة', '20 شارع فوزي معاذ'],
        ['سارة حسن', '01501234504', 'الشرقية', 'الزقازيق', 'شارع الجامعة'],
        ['كريم عادل', '01001234505', 'الدقهلية', 'المنصورة', 'شارع الجمهورية'],
        ['ياسمين فؤاد', '01101234506', 'القليوبية', 'بنها', 'شارع فريد ندا'],
        ['عمر خالد', '01201234507', 'أسيوط', 'أسيوط', 'شارع يسري راغب'],
        ['هبة مصطفى', '01501234508', 'المنيا', 'المنيا', 'كورنيش النيل'],
        ['محمود جمال', '01001234509', 'الغربية', 'طنطا', 'شارع البحر'],
        ['نورهان أشرف', '01101234510', 'سوهاج', 'سوهاج', 'شارع الجمهورية'],
        ['إسلام رضا', '01201234511', 'البحيرة', 'دمنهور', 'شارع عبد السلام الشاذلي'],
        ['دينا طارق', '01501234512', 'بورسعيد', 'بورفؤاد', 'شارع 23 يوليو'],
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('DemoSeeder never runs in production.');
        }

        $this->call(ThemeSeeder::class);

        User::query()->firstOrCreate(['email' => self::ADMIN_EMAIL], [
            'tenant_id' => null,
            'name' => 'مدير المنصة',
            'phone' => '+201099990000',
            'password' => self::PASSWORD,
            'role' => UserRole::SuperAdmin,
            'is_active' => true,
        ]);

        if (User::query()->where('email', self::OWNER_EMAIL)->exists()) {
            $this->command?->info('Demo store already exists.');

            return;
        }

        $registered = app(RegisterTenant::class)->handle([
            'name' => 'محمد رشاد',
            'email' => self::OWNER_EMAIL,
            'phone' => '+201012345600',
            'store_name' => 'Demo Store',
            'password' => self::PASSWORD,
        ]);

        // The demo store tries every feature (owner decision: demo accounts get Pro).
        app(SubscriptionManager::class)->grant($registered['tenant'], 'pro', 365, 'demo', null);
        // …and owns the paid themes its pages use.
        foreach (['celia', 'layali'] as $theme) {
            app(ThemeAccess::class)->grant($registered['tenant'], $theme, 'admin_grant', null, 0, 'demo');
        }

        Tenancy::runAs($registered['tenant']->id, fn () => $this->store($registered['user']->id, $registered['domain']->host));
    }

    private function store(int $userId, string $host): void
    {
        $product = app(SaveProduct::class)->handle([
            'name' => 'ساعة ذكية رياضية',
            'description' => "ساعة ذكية بشاشة **AMOLED** وبطارية تكفي 7 أيام.\n\n- مقاومة للمياه\n- قياس نبض القلب والنوم\n- إشعارات الموبايل",
            'price' => '850',
            'compare_at_price' => '1200',
            'sku' => 'WATCH-01',
            'is_active' => true,
            'options' => [
                ['name' => 'اللون', 'display_type' => 'swatch', 'is_required' => true, 'values' => [
                    ['label' => 'أسود', 'color_hex' => '#111827', 'price_delta' => '0', 'is_active' => true],
                    ['label' => 'فضي', 'color_hex' => '#D1D5DB', 'price_delta' => '0', 'is_active' => true],
                    ['label' => 'ذهبي', 'color_hex' => '#D4A017', 'price_delta' => '50', 'is_active' => true],
                ]],
                ['name' => 'المقاس', 'display_type' => 'buttons', 'is_required' => true, 'values' => [
                    ['label' => '42 مم', 'price_delta' => '0', 'is_active' => true],
                    ['label' => '46 مم', 'price_delta' => '30', 'is_active' => true],
                ]],
            ],
        ]);

        app(SaveOffer::class)->handle([
            'name' => 'اشترِ 2 بسعر مميز',
            'type' => OfferType::Bundle,
            'value' => null,
            'bundle_quantity' => 2,
            'bundle_price' => '1500.00',
            'is_active' => true,
            'badge_text' => 'الأكثر طلبًا',
            'priority' => 1,
        ], [$product->id]);

        app(SaveDiscountCode::class)->handle([
            'code' => 'WELCOME10',
            'type' => DiscountType::Percentage,
            'value' => '10.00',
            'max_discount' => '150.00',
            'usage_limit' => 100,
            'stackable_with_offers' => false,
            'is_active' => true,
        ], [$product->id]);

        $malak = $this->page('عرض الساعة الذكية', 'smart-watch', 'malak', $product, $userId);
        $this->page('الساعة الذكية (تصميم سيليا)', 'smart-watch-celia', 'celia', $product, $userId);
        app(PageLifecycle::class)->setHome($malak);

        $this->orders($malak->fresh(), $product, $host, $userId);
    }

    private function page(string $title, string $slug, string $theme, Product $product, int $userId): LandingPage
    {
        $variants = $theme === 'malak'
            ? ['header' => 'centered-logo', 'hero' => 'split', 'product_showcase' => 'card', 'features' => 'icon-cards', 'offers' => 'cards', 'testimonials' => 'cards-slider', 'faq' => 'accordion-soft', 'order_form' => 'card', 'footer' => 'simple-center']
            : ['header' => 'bar', 'hero' => 'big-type', 'product_showcase' => 'split-image', 'features' => 'numbered-grid', 'offers' => 'bundle-tiles', 'testimonials' => 'quote-wall', 'faq' => 'accordion-lines', 'order_form' => 'bordered', 'footer' => 'dark-columns'];

        // Empty props fall back to each section's defaults; only the hero gets custom copy.
        $sections = [];
        foreach ($variants as $type => $variant) {
            $sections[] = [
                'id' => (string) Str::uuid(),
                'type' => $type,
                'variant' => $variant,
                'visible' => true,
                'props' => $type === 'hero' ? ['title' => 'ساعتك الذكية بأقل سعر في مصر', 'subtitle' => 'شحن مجاني والدفع عند الاستلام — جرّبها 14 يوم.'] : [],
            ];
        }

        $page = app(CreatePage::class)->handle([
            'title' => $title,
            'slug' => $slug,
            'theme_key' => $theme,
            'product_id' => $product->id,
            'content' => ['version' => 1, 'sections' => $sections],
        ], $userId);

        return app(PublishPage::class)->handle($page);
    }

    /** 24 orders over 14 days, in every status, through the real order flow. */
    private function orders(LandingPage $page, Product $product, string $host, int $userId): void
    {
        $product->load('options.values');
        $statuses = [OrderStatus::New, OrderStatus::Confirmed, OrderStatus::Delivered, OrderStatus::Delivered, OrderStatus::Returned, OrderStatus::Fake, OrderStatus::Cancelled, OrderStatus::Damaged];
        $tokens = app(FormToken::class);

        for ($i = 0; $i < 24; $i++) {
            [$name, $phone, $governorate, $city, $address] = self::CUSTOMERS[$i % count(self::CUSTOMERS)];
            $options = [];
            foreach ($product->options as $option) {
                $values = $option->values->values();
                $options[$option->id] = $values[$i % $values->count()]->id;
            }

            $result = app(CreateOrder::class)->handle($page, [
                'host' => $host,
                'slug' => $page->slug,
                'quantity' => $i % 5 === 0 ? 2 : 1,
                'options' => $options,
                'code' => $i % 6 === 1 ? 'WELCOME10' : null,
                'customer' => ['name' => $name, 'phone' => $phone, 'governorate' => $governorate, 'city' => $city, 'address' => $address],
                'answers' => [],
                'form_token' => $tokens->issue($page->id, time() - 10),
                'website' => '',
                'utm' => $i % 3 === 0 ? ['source' => 'facebook', 'medium' => 'cpc', 'campaign' => 'watch-launch'] : [],
                // One IP per order keeps the per-IP limit out of the way.
                'ip' => '41.33.0.'.($i + 10),
                'user_agent' => 'Mozilla/5.0 (Linux; Android 14)',
            ]);

            $order = Order::query()->where('order_number', $result['order_number'])->firstOrFail();
            $status = $i < 4 ? OrderStatus::New : $statuses[$i % count($statuses)];
            if ($status !== OrderStatus::New) {
                $path = match ($status) {
                    OrderStatus::Delivered, OrderStatus::Damaged => [OrderStatus::Confirmed],
                    OrderStatus::Returned => [OrderStatus::Confirmed, OrderStatus::Delivered],
                    default => [],
                };
                foreach ([...$path, $status] as $step) {
                    if ($order->status !== $step) {
                        $order = app(ChangeOrderStatus::class)->handle($order, $step, null, $userId);
                    }
                }
            }

            // Spread over the last 14 days for the dashboard chart.
            $created = now()->subDays(13 - intdiv($i * 14, 24))->subMinutes(($i * 37) % 600);
            $order->forceFill(['created_at' => $created, 'status_changed_at' => $created->copy()->addHours(3)])->saveQuietly();
        }
    }
}
