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
    /** The free themes we ship: «بداية» for landing pages, «أساس» for the store (paid themes are added by the admin). */
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
