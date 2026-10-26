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

    // Shared secrets (compared with hash_equals).
    'internal_api_key' => (string) env('INTERNAL_API_KEY', ''),
    'revalidate_secret' => (string) env('REVALIDATE_SECRET', ''),
    'front_internal_url' => rtrim((string) env('FRONT_INTERNAL_URL', ''), '/'),

    'token_ttl_days' => 30,

    // Storage is UTC; dates sent by the dashboard are Cairo local time.
    'display_timezone' => 'Africa/Cairo',

    'reserved_subdomains' => [
        'www', 'app', 'api', 'admin', 'mail', 'ftp', 'static', 'media', 'cdn', 'platform',
        'support', 'billing', 'dashboard', 'cname', 'ns1', 'ns2', 'test', 'staging', 'dev',
    ],

    'reserved_slugs' => [
        'api', '_next', 'admin', 'dashboard', 'login', 'register', 'preview', 'media',
        'sitemap', 'robots', 'favicon', 'thank-you',
    ],

    // Internal safety limits (no plans/billing UI).
    'limits' => [
        'pages' => 200,
        'products' => 500,
        'media' => 2000,
        'discount_codes' => 500,
        'offers' => 200,
        'custom_domains' => 10,
        'upload_max_kb' => 5 * 1024,
        'upload_files_per_request' => 10,
        'sections_per_page' => 30,
        'content_max_bytes' => 256 * 1024,
        'content_max_depth' => 5,
        'content_max_array_items' => 50,
        'export_max_rows' => 10000,
    ],

    'duplicate_order_window_hours' => 24,

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
