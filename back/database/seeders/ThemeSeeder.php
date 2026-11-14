<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Theme;
use App\Models\ThemeTag;
use Illuminate\Database\Seeder;

/**
 * Safe to run on every deploy. A theme in the code gets its row; its store details (price,
 * texts, tags) are written only the first time, so the admin's edits are never overwritten.
 */
class ThemeSeeder extends Seeder
{
    /** The themes we ship: «بداية» (landing pages) and «أساس» (store) for free, «صوفي» paid (the admin sets its price). */
    private const THEMES = [
        [
            'key' => 'bidaya', 'name' => 'بداية', 'sort_order' => 1, 'price' => 0,
            'short_description' => 'ثيم صفحة الهبوط المجاني: بسيط وسريع، ومعمول علشان يبيع منتج واحد.',
            'description' => 'صفحة لمنتج واحد بأقسام تظبطها بنفسك (البداية، المميزات، صور المنتج، آراء العملاء، الأسئلة الشائعة) وفورم طلب بالدفع عند الاستلام، بألوانك وخطك.',
            'features' => ['5 أقسام + فورم الطلب', 'سريعة على الموبايل', 'ألوانك وخطك ولوجو متجرك'],
            'tags' => ['general'],
        ],
        [
            'key' => 'asas', 'name' => 'أساس', 'sort_order' => 10, 'price' => 0, 'kind' => 'store',
            'short_description' => 'ثيم المتجر المجاني: بسيط وسريع، وكل اللي محتاجه علشان تبيع.',
            'description' => 'رئيسية بأقسام تظبطها بنفسك (بنر، قوائم منتجات، مميزات المتجر، آراء العملاء)، وألوانك وخطك ولوجو متجرك.',
            'features' => ['بنر وسلايدر', 'قوائم منتجات بشبكة أو سلايدر', 'ألوانك وخطك ولوجو متجرك'],
            'tags' => ['general'],
        ],
        [
            'key' => 'sufi', 'name' => 'صوفي', 'sort_order' => 20, 'price' => 990, 'kind' => 'store',
            'short_description' => 'ثيم متجر فخم وفاتح، معاه وضع ليلي، للملابس والإلكترونيات والإكسسوارات.',
            'description' => 'رئيسية بـ 16 قسم تظبطها بنفسك: بنر بملء الشاشة مدموج مع الهيدر، شريط متحرك، تصنيفات بالصور، منتجات بتبويبات، بنرات، عرض بعداد تنازلي، منتج مميز يتضاف للسلة من الرئيسية، فيديو، براندات، قصة المتجر، مميزات، آراء العملاء، معرض صور، أسئلة شائعة، وفروعك على الخريطة. ووضع ليلي بألوان تختارها، وأزرار واتساب واتصال عائمة. بتشتريه مرة واحدة وبيفضل معاك بكل تحديثاته.',
            'features' => ['16 قسم للرئيسية', 'وضع ليلي بألوانك', 'بنر بملء الشاشة مدموج مع الهيدر', 'منتج مميز وعرض بعداد تنازلي'],
            'tags' => ['fashion', 'electronics', 'accessories'],
        ],
    ];

    private const TAGS = [
        'general' => 'عام', 'fashion' => 'ملابس', 'accessories' => 'إكسسوارات', 'perfumes' => 'عطور',
        'electronics' => 'إلكترونيات', 'beauty' => 'مستحضرات تجميل', 'home' => 'منزل',
    ];

    public function run(): void
    {
        $order = 0;
        foreach (self::TAGS as $slug => $name) {
            ThemeTag::query()->firstOrCreate(['slug' => $slug], ['name' => $name, 'sort_order' => ++$order]);
        }

        foreach (self::THEMES as $theme) {
            $existing = Theme::query()->find($theme['key']);

            if ($existing === null) {
                $existing = Theme::create(['key' => $theme['key'], 'name' => $theme['name'], 'sort_order' => $theme['sort_order'], 'is_active' => true]);
            } else {
                // Keep the admin's is_active choice; refresh name and order only.
                $existing->update(['name' => $theme['name'], 'sort_order' => $theme['sort_order']]);
            }

            // First time only: the store details (afterwards they belong to the admin).
            if ($existing->short_description === null && ! $existing->is_listed) {
                $existing->update([
                    'kind' => $theme['kind'] ?? 'landing',
                    'short_description' => $theme['short_description'],
                    'description' => $theme['description'],
                    'features' => $theme['features'],
                    'price' => $theme['price'],
                    'is_listed' => true,
                    'released_at' => now(),
                    'version' => '1.0',
                ]);
                $existing->tags()->sync(ThemeTag::query()->whereIn('slug', $theme['tags'])->pluck('id')->all());
            }
        }
    }
}
