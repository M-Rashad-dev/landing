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
    /** Owner decision: Malak free, Celia 100, Layali 150 (landing themes); store: Rewaq free, Diwan 200. */
    private const THEMES = [
        [
            'key' => 'malak', 'name' => 'ملاك', 'sort_order' => 1, 'price' => 0,
            'short_description' => 'ثيم ناعم وهادي، مناسب لأي منتج.',
            'description' => 'ألوان هادية وزوايا ناعمة وحركة خفيفة مع السكرول. مجاني لكل المتاجر.',
            'features' => ['16 قسم جاهز', 'متوافق مع الموبايل', 'ألوان وخطوط من هويتك'],
            'tags' => ['general'],
        ],
        [
            'key' => 'celia', 'name' => 'سيليا', 'sort_order' => 2, 'price' => 100,
            'short_description' => 'ثيم جريء بحدود واضحة وعناوين كبيرة.',
            'description' => 'تصميم قوي بيلفت النظر، مناسب للعروض والمنتجات اللي محتاجة طاقة.',
            'features' => ['16 قسم جاهز', 'أزرار وحدود جريئة', 'ألوان وخطوط من هويتك'],
            'tags' => ['fashion', 'electronics'],
        ],
        [
            'key' => 'layali', 'name' => 'ليالي', 'sort_order' => 3, 'price' => 150,
            'short_description' => 'ثيم ليلي فخم بلمسات زجاجية ولمعة.',
            'description' => 'خلفية داكنة من ألوان هويتك، عناوين متدرجة وتوهج خفيف. مناسب للعطور والهدايا والمنتجات الفاخرة.',
            'features' => ['وضع ليلي من ألوانك', 'لمسات زجاج وتوهج', 'مناسب للمنتجات الفاخرة'],
            'tags' => ['perfumes', 'accessories'],
        ],
        [
            'key' => 'rewaq', 'name' => 'رواق', 'sort_order' => 10, 'price' => 0, 'kind' => 'store',
            'short_description' => 'ثيم متجر نظيف وسريع، مجاني لكل المتاجر.',
            'description' => 'هيدر بقائمة وسلة، صفحات تصنيفات بفلاتر وبحث، صفحة منتج بالخيارات والمخزون، سلة وإتمام طلب في صفحة واحدة.',
            'features' => ['قائمة تصنيفات متعددة المستويات', 'فلاتر وبحث وترتيب', 'سلة وإتمام طلب سريع'],
            'tags' => ['general'],
        ],
        [
            'key' => 'diwan', 'name' => 'ديوان', 'sort_order' => 11, 'price' => 200, 'kind' => 'store',
            'short_description' => 'ثيم متجر ليلي فخم بأسطح زجاجية.',
            'description' => 'خلفية داكنة من ألوان هويتك، بطاقات منتجات زجاجية وتوهج خفيف، نفس مميزات المتجر كاملة. مناسب للعطور والساعات والهدايا الفاخرة.',
            'features' => ['وضع ليلي من ألوانك', 'بطاقات منتجات فخمة', 'كل أقسام المتجر'],
            'tags' => ['perfumes', 'accessories'],
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
