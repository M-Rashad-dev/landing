<?php

declare(strict_types=1);

return [
    // Starter copy of a store on «تيكنو» (electronics: phones, laptops, accessories; the merchant edits it in the
    // Builder). From the approved mockup (docs/plans/tekno/mockup/home.html); its prices, brands and reviews are
    // the showcase's only.
    'announcement' => 'شحن مجاني فوق 2000 ج · ضمان الوكيل على كل الأجهزة',
    'hero' => [
        'kicker' => 'وصل حديثًا',
        'title' => 'لابتوب بأداء يجري معاك في الشغل واللعب',
        'highlight' => 'يجري',
        'chips' => ['Core i7', '16GB RAM', '512GB SSD', 'شاشة 15.6"'],
        'button' => 'اشتري دلوقتي',
        'second' => 'المواصفات كاملة',
        'tiles' => [
            ['kicker' => 'سماعات', 'title' => 'صوت نقي وعزل ضوضاء', 'color' => '#0e7490'],
            ['kicker' => 'جيمنج', 'title' => 'كل اللي محتاجه للعب', 'color' => '#3730a3'],
        ],
    ],
    'trust' => [
        ['icon' => 'badge-check', 'title' => 'ضمان الوكيل', 'text' => 'سنة على الأقل'],
        ['icon' => 'return', 'title' => 'استبدال 14 يوم', 'text' => 'لو فيه عيب صناعة'],
        ['icon' => 'tag', 'title' => 'تقسيط بدون مقدم', 'text' => 'لحد 24 شهر'],
        ['icon' => 'truck', 'title' => 'توصيل سريع', 'text' => 'لكل المحافظات'],
        ['icon' => 'cash', 'title' => 'الدفع عند الاستلام', 'text' => 'أو كارت ومحفظة'],
    ],
    'categories_title' => 'تسوّق حسب القسم',
    'tabs' => [
        'kicker' => 'الأكثر طلبًا',
        'title' => 'اختار جهازك',
        'best_sellers' => 'الأكثر مبيعًا',
        'latest' => 'وصل حديثًا',
        'offers' => 'عروض',
    ],
    // The merchant's own brands replace these (logos or names); the section starts hidden until he does.
    'brands' => [
        'title' => 'براندات بنتعامل معاها',
        'item' => 'براند :n',
    ],
    'services' => [
        'title' => 'الضمان وخدمة ما بعد البيع',
        'items' => [
            ['icon' => 'badge-check', 'title' => 'ضمان الوكيل الرسمي', 'text' => 'على كل الأجهزة، والمدة مكتوبة في صفحة كل منتج.'],
            ['icon' => 'wrench', 'title' => 'مراكز صيانة', 'text' => 'في القاهرة والإسكندرية والمنصورة.'],
            ['icon' => 'return', 'title' => 'استبدال 14 يوم', 'text' => 'لو فيه عيب صناعة، من غير أسئلة.'],
            ['icon' => 'headset', 'title' => 'دعم فني', 'text' => 'واتساب من 10 الصبح لـ 10 بالليل.'],
        ],
    ],
    'testimonials_title' => 'آراء العملاء',
    // The installments settings («التقسيط»): display only, never a way to pay.
    'installments' => [
        'providers' => ['شركة تقسيط 1', 'شركة تقسيط 2', 'كروت البنوك'],
    ],
    'card' => [
        // The spec row a card draws as a dark badge on the picture (جديد / كسر زيرو / مستعمل).
        'badge_label' => 'الحالة',
    ],
];
