<?php

declare(strict_types=1);

return [

    /*
    | Platform hosts. PLATFORM_DOMAIN hosts the marketing page and the free
    | subdomains (label.PLATFORM_DOMAIN). APP_HOST hosts the dashboard.
    */
    'platform_domain' => strtolower((string) env('PLATFORM_DOMAIN', 'localhost')),
    'app_host' => strtolower((string) env('APP_HOST', 'app.localhost')),
    'server_ip' => (string) env('SERVER_IP', '127.0.0.1'),
    'cname_target' => strtolower((string) env('CNAME_TARGET', 'cname.'.env('PLATFORM_DOMAIN', 'localhost'))),

    // Two-part public suffixes, so "shop.com.eg" counts as a root domain (A record) and
    // "www.shop.com.eg" as a subdomain (CNAME). No external public-suffix list at runtime.
    'two_part_suffixes' => [
        'com.eg', 'net.eg', 'org.eg', 'edu.eg', 'gov.eg', 'sci.eg', 'info.eg', 'name.eg', 'tv.eg',
        'com.sa', 'net.sa', 'org.sa', 'edu.sa', 'med.sa', 'com.kw', 'net.kw', 'org.kw', 'com.qa', 'net.qa',
        'com.bh', 'com.om', 'co.om', 'co.ae', 'net.ae', 'org.ae', 'com.jo', 'com.lb', 'com.ly', 'com.tn',
        'com.dz', 'co.ma', 'net.ma', 'com.iq', 'com.sy', 'com.ps', 'com.sd', 'com.ye', 'com.tr',
        'co.uk', 'org.uk', 'me.uk', 'com.au', 'net.au', 'co.in', 'co.za', 'com.br', 'co.nz', 'co.jp',
    ],

    // Shared secrets (compared with hash_equals).
    'internal_api_key' => (string) env('INTERNAL_API_KEY', ''),
    'revalidate_secret' => (string) env('REVALIDATE_SECRET', ''),
    'front_internal_url' => rtrim((string) env('FRONT_INTERNAL_URL', ''), '/'),

    // Public page URLs (canonical, sitemap). Local development: http + 3000.
    'public_scheme' => (string) env('PUBLIC_SCHEME', 'https'),
    'public_port' => env('PUBLIC_PORT') ?: null,

    'token_ttl_days' => 30,

    // Storage is UTC; dates sent by the dashboard are Cairo local time.
    'display_timezone' => 'Africa/Cairo',

    'reserved_subdomains' => [
        'www', 'app', 'api', 'admin', 'mail', 'ftp', 'static', 'media', 'cdn', 'platform',
        'support', 'billing', 'dashboard', 'cname', 'ns1', 'ns2', 'test', 'staging', 'dev',
    ],

    'reserved_slugs' => [
        'api', '_next', 'admin', 'dashboard', 'login', 'register', 'preview', 'media',
        'sitemap', 'robots', 'favicon', 'thank-you', 'track',
        // Store routes (the store owns these paths on the tenant host).
        'products', 'categories', 'cart', 'checkout', 'pages', 'search', 'offers', 'account',
    ],

    // Platform safety ceilings. Plan limits (admin) apply below these; "unlimited" means up to here.
    'limits' => [
        'pages' => 200,
        'products' => 10000,
        'media' => 30000,
        'discount_codes' => 500,
        'offers' => 200,
        'custom_domains' => 10,
        'media_storage_mb' => 50000,
        'webhooks' => 10,
        'ab_tests' => 20,
        'store_categories' => 500,
        'store_pages' => 50,
        'category_depth' => 5,
        'upload_max_kb' => 5 * 1024,
        'upload_files_per_request' => 10,
        'sections_per_page' => 30,
        'content_max_bytes' => 256 * 1024,
        'content_max_depth' => 5,
        'content_max_array_items' => 50,
        'export_max_rows' => 10000,
    ],

    // Plans and subscriptions (docs/features/3-PLANS.md). Prices, limits and the trial are set in the admin.
    'billing' => [
        'currency' => 'EGP',
        // Upgrading within these days of a paid period costs only the difference.
        'upgrade_difference_days' => 7,
        'refund_days' => 3,
        'refund_cooldown_days' => 180,
        'renewal_reminder_days' => [7, 3, 1],
        'max_discount_percent' => 90,
    ],

    'duplicate_order_window_hours' => 24,

    /*
     * Automatic phone blocking (owner rules, Nov 2026), per where the order came from:
     * same_in_row = that many identical orders in a row (same products, within window_hours);
     * per_day = that many orders in one Cairo day; returns = at least returns_min returned
     * orders that are more than returns_ratio % of the phone's orders (not counting cancelled).
     */
    'auto_block' => [
        'window_hours' => 24,
        'landing' => ['same_in_row' => 3, 'per_day' => 5, 'returns_min' => 3, 'returns_ratio' => 75],
        'store' => ['same_in_row' => 3, 'per_day' => 6, 'returns_min' => 5, 'returns_ratio' => 75],
    ],

    'order_number_start' => 1001,

    'fonts' => ['cairo', 'tajawal', 'almarai', 'ibm_plex_arabic', 'noto_kufi', 'readex_pro'],

    'button_radii' => ['none', 'sm', 'md', 'lg', 'full'],

    'default_colors' => [
        'primary' => '#7C3AED',
        'primary_foreground' => '#FFFFFF',
        'secondary' => '#F5F3FF',
        'accent' => '#F59E0B',
        'background' => '#FFFFFF',
        'foreground' => '#1F2937',
        'muted' => '#6B7280',
        'border' => '#E5E7EB',
    ],

    'component_types' => [
        'header', 'hero', 'gallery', 'product_showcase', 'features',
        'offers', 'testimonials', 'faq', 'order_form', 'footer',
        'video', 'before_after', 'size_chart', 'comparison', 'countdown', 'sticky_cta',
    ],

    'components' => [
        'singleton' => ['header', 'footer'],
        'pinned' => ['header' => 'top', 'footer' => 'bottom'],
        'max_per_type' => [
            'header' => 1,
            'footer' => 1,
            'order_form' => 1,
            'hero' => 5,
            'gallery' => 5,
            'product_showcase' => 5,
            'features' => 10,
            'offers' => 5,
            'testimonials' => 5,
            'faq' => 5,
            'video' => 5,
            'before_after' => 5,
            'size_chart' => 3,
            'comparison' => 3,
            'countdown' => 3,
            'sticky_cta' => 1,
        ],
    ],

    // The 27 Egyptian governorates (Arabic names are the stored values).
    'governorates' => [
        'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية',
        'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس',
        'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
        'البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء',
    ],

];
