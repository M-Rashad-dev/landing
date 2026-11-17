<?php

declare(strict_types=1);

namespace App\Themes\Store;

use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * «شابع · متجر», the food store theme (restaurants, home kitchens, sweets, boxes). Its own look
 * from «شابع» the landing theme, sold apart from it. The base settings plus: a dark color for its
 * dark sections, the display font for titles, the button shape, a header with a countdown,
 * hotline and order button, a light or dark footer, floating call and motion. 15 home sections,
 * among them «مواعيد العمل» (open now / closed messages by Cairo time).
 */
final class ShabeStoreDesign extends StoreThemeDesign
{
    public const KEY = 'shabe_store';

    public const SECTION_TYPES = [
        'food_hero', 'marquee', 'categories', 'product_tabs', 'bundles', 'products', 'why', 'steps',
        'countdown', 'video', 'gallery', 'testimonials', 'hours', 'faq', 'location',
    ];

    public const MAX_SECTIONS = 30;

    /** «شابع» draws its product cards and product page its own way, so it has their settings. */
    public const SETTINGS_GROUPS = ['look', 'header', 'footer', 'general', 'product_card', 'product_page', 'listing', 'cart'];

    /** The product card (designs saved before these settings read them). */
    public const CARD_DEFAULTS = [
        'image' => 'square',
        'show_description' => true,
        'show_rating' => true,
        'button' => 'icon',
        'border_width' => 1,
        // null: the theme's own line color.
        'border_color' => null,
        'radius' => 24,
        'shadow' => false,
    ];

    /** The product page (designs saved before these settings read them). */
    public const PAGE_DEFAULTS = [
        'gallery' => 'thumbs',
        'zoom' => true,
        'description' => true,
        'reviews' => true,
        'whatsapp_ask' => true,
        'related_enabled' => true,
        'related' => 'category',
        'sticky_bar' => true,
        'sticky_buttons' => 'both',
        // «يشاهدون هذا المنتج الآن»: a number picked at random between min and max, every few seconds.
        'viewers' => ['enabled' => false, 'min' => 300, 'max' => 600, 'every' => 15],
    ];

    public const VIEWERS_MAX = 999000;

    /** Category, all-products and offers pages (designs saved before these settings read them). */
    public const LISTING_DEFAULTS = [
        'columns_desktop' => 4,
        'columns_mobile' => 2,
        // The category's picture and description on top of its page.
        'banner' => true,
        'subcategories' => 'circles',
        // open: always shown; button: behind «فلتر»; hidden: none.
        'filters' => 'button',
    ];

    /** The cart (designs saved before these settings read them). */
    public const CART_DEFAULTS = [
        'free_shipping_bar' => true,
        'suggestions_enabled' => true,
        'suggestions' => 'offers',
        // «ملاحظات للمطبخ»: written in the cart, carried to the checkout's notes.
        'kitchen_notes' => true,
    ];

    public const DEFAULT_COLORS = ['primary' => '#e4572e', 'secondary' => '#f2b33d', 'background' => '#fffaf2', 'text' => '#1b120c'];

    /** The background of the dark sections («ليه إحنا»، the footer when dark). */
    public const DEFAULT_DARK = '#17110d';

    public const BUTTONS = ['rounded', 'pill', 'square'];

    public const HEADER_LAYOUTS = ['start', 'center'];

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public function defaults(?int $logoMediaId = null): array
    {
        $base = self::baseDefaults($logoMediaId);
        $t = fn (string $key) => __('themes/store/shabe.'.$key);
        $offers = ['type' => 'offers', 'target_id' => null, 'url' => null];
        $all = ['type' => 'all_products', 'target_id' => null, 'url' => null];
        $hours = array_fill(0, StoreSections::WEEK_DAYS, ['open' => true, 'from' => '12:00', 'to' => '23:00']);

        return [
            'settings' => [
                ...$base,
                'colors' => [...self::DEFAULT_COLORS, 'dark' => self::DEFAULT_DARK],
                'display_font' => true,
                'button' => 'pill',
                'header' => [
                    ...$base['header'],
                    'announcement' => (string) $t('announcement'),
                    'layout' => 'start',
                    'countdown_ends_at' => null,
                    'hotline' => null,
                    'button_label' => (string) $t('order_now'),
                    'button_link' => $all,
                    'categories_menu' => true,
                ],
                'footer' => [...$base['footer'], 'dark' => true, 'payments' => true],
                'general' => [...$base['general'], 'floating_call' => false, 'call_phone' => null, 'animations' => true],
                'product_card' => self::CARD_DEFAULTS,
                'product_page' => self::PAGE_DEFAULTS,
                'listing' => self::LISTING_DEFAULTS,
                'cart' => self::CART_DEFAULTS,
            ],
            'sections' => [
                self::section('food_hero', [
                    'kicker' => (string) $t('hero.kicker'),
                    'title' => (string) $t('hero.title'),
                    'highlight' => (string) $t('hero.highlight'),
                    'subtitle' => (string) $t('hero.subtitle'),
                    'media_id' => null,
                    'stickers' => (array) $t('hero.stickers'),
                    'badge' => (string) $t('hero.badge'),
                    'primary_label' => (string) $t('order_now'),
                    'primary_link' => $all,
                    'second_label' => (string) $t('hero.second'),
                    'second_link' => $offers,
                    'trust' => (array) $t('hero.trust'),
                ]),
                self::section('marquee', ['items' => (array) $t('marquee'), 'speed' => 'normal']),
                self::section('categories', ['title' => (string) $t('categories_title'), 'description' => null, 'category_ids' => [], 'shape' => 'circle', 'layout' => 'slider', 'columns_desktop' => 6, 'columns_mobile' => 3]),
                self::section('product_tabs', ['title' => (string) $t('tabs_title'), 'description' => null, 'limit' => 8, 'tabs' => [
                    ['label' => (string) $t('tab_latest'), 'source' => 'latest', 'category_id' => null, 'product_ids' => []],
                    ['label' => (string) $t('tab_offers'), 'source' => 'offers', 'category_id' => null, 'product_ids' => []],
                ]]),
                self::section('why', ['kicker' => (string) $t('why.kicker'), 'title' => (string) $t('why.title'), 'subtitle' => null, 'media_id' => null, 'quote' => null, 'items' => (array) $t('why.items')]),
                self::section('steps', ['kicker' => null, 'title' => (string) $t('steps.title'), 'items' => (array) $t('steps.items')]),
                self::section('testimonials', ['title' => (string) $t('testimonials_title'), 'source' => 'auto', 'items' => []]),
                self::section('hours', ['title' => (string) $t('hours.title'), 'subtitle' => null, 'days' => $hours, 'open_message' => (string) $t('hours.open_message'), 'closed_message' => (string) $t('hours.closed_message')]),
                self::section('faq', ['title' => (string) $t('faq_title'), 'text' => null, 'whatsapp_button' => true, 'items' => (array) $t('faq')]),
            ],
        ];
    }

    /** @param array<string, mixed> $settings @return array<string, mixed> */
    protected function settingsRules(string $p, array $settings): array
    {
        $phone = ['nullable', 'string', 'max:30', 'regex:/^[0-9+ ()-]{6,30}$/'];

        return [
            ...$this->baseSettingsRules($p),
            "{$p}.settings.colors.dark" => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            "{$p}.settings.display_font" => ['required', 'boolean'],
            "{$p}.settings.button" => ['required', Rule::in(self::BUTTONS)],
            "{$p}.settings.header.layout" => ['required', Rule::in(self::HEADER_LAYOUTS)],
            "{$p}.settings.header.countdown_ends_at" => ['nullable', 'date'],
            // Short hotlines too (19xxx).
            "{$p}.settings.header.hotline" => ['nullable', 'string', 'max:30', 'regex:/^[0-9+ ()-]{3,30}$/'],
            "{$p}.settings.header.button_label" => StoreSections::text(30),
            ...StoreSections::linkRules("{$p}.settings.header.button_link", (array) ($settings['header']['button_link'] ?? [])),
            "{$p}.settings.header.categories_menu" => ['required', 'boolean'],
            "{$p}.settings.footer.dark" => ['required', 'boolean'],
            "{$p}.settings.footer.payments" => ['required', 'boolean'],
            "{$p}.settings.general.floating_call" => ['required', 'boolean'],
            "{$p}.settings.general.call_phone" => $phone,
            "{$p}.settings.general.animations" => ['required', 'boolean'],
            // Missing in designs saved before them: their defaults are used.
            "{$p}.settings.product_card" => ['sometimes', 'array'],
            "{$p}.settings.product_card.image" => ['sometimes', Rule::in(['square', 'wide', 'circle'])],
            "{$p}.settings.product_card.show_description" => ['sometimes', 'boolean'],
            "{$p}.settings.product_card.show_rating" => ['sometimes', 'boolean'],
            "{$p}.settings.product_card.button" => ['sometimes', Rule::in(['icon', 'full'])],
            "{$p}.settings.product_card.border_width" => ['sometimes', 'integer', 'between:0,6'],
            "{$p}.settings.product_card.border_color" => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            "{$p}.settings.product_card.radius" => ['sometimes', 'integer', 'between:0,40'],
            "{$p}.settings.product_card.shadow" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page" => ['sometimes', 'array'],
            "{$p}.settings.product_page.gallery" => ['sometimes', Rule::in(['thumbs', 'slider'])],
            "{$p}.settings.product_page.zoom" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page.description" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page.reviews" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page.whatsapp_ask" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page.related_enabled" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page.related" => ['sometimes', Rule::in(['category', 'similar'])],
            "{$p}.settings.product_page.sticky_bar" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page.sticky_buttons" => ['sometimes', Rule::in(['cart', 'both', 'buy'])],
            "{$p}.settings.product_page.viewers.enabled" => ['sometimes', 'boolean'],
            "{$p}.settings.product_page.viewers.min" => ['sometimes', 'integer', 'between:1,'.self::VIEWERS_MAX],
            "{$p}.settings.product_page.viewers.max" => ['sometimes', 'integer', 'between:1,'.self::VIEWERS_MAX, 'gte:'.$p.'.settings.product_page.viewers.min'],
            "{$p}.settings.product_page.viewers.every" => ['sometimes', 'integer', 'between:3,300'],
            "{$p}.settings.listing" => ['sometimes', 'array'],
            "{$p}.settings.listing.columns_desktop" => ['sometimes', 'integer', 'between:2,5'],
            "{$p}.settings.listing.columns_mobile" => ['sometimes', 'integer', 'between:1,2'],
            "{$p}.settings.listing.banner" => ['sometimes', 'boolean'],
            "{$p}.settings.listing.subcategories" => ['sometimes', Rule::in(['circles', 'chips'])],
            "{$p}.settings.listing.filters" => ['sometimes', Rule::in(['open', 'button', 'hidden'])],
            "{$p}.settings.cart" => ['sometimes', 'array'],
            "{$p}.settings.cart.free_shipping_bar" => ['sometimes', 'boolean'],
            "{$p}.settings.cart.suggestions_enabled" => ['sometimes', 'boolean'],
            "{$p}.settings.cart.suggestions" => ['sometimes', Rule::in(['offers', 'latest'])],
            "{$p}.settings.cart.kitchen_notes" => ['sometimes', 'boolean'],
        ];
    }

    /** @param array<string, mixed> $s @return array<string, mixed> */
    protected function cleanSettings(array $s): array
    {
        $str = StoreSections::str(...);
        $base = $this->cleanBaseSettings($s);
        $ends = $s['header']['countdown_ends_at'] ?? null;

        return [
            ...$base,
            'colors' => [...$base['colors'], 'dark' => strtolower((string) $s['colors']['dark'])],
            'display_font' => (bool) $s['display_font'],
            'button' => (string) $s['button'],
            'header' => [
                ...$base['header'],
                'layout' => (string) $s['header']['layout'],
                // Stored in UTC; the Builder sends the merchant's local time with its offset.
                'countdown_ends_at' => $ends === null || $ends === '' ? null : Carbon::parse((string) $ends)->utc()->toIso8601ZuluString(),
                'hotline' => $str($s['header']['hotline'] ?? null),
                'button_label' => $str($s['header']['button_label'] ?? null),
                'button_link' => StoreSections::cleanLink((array) $s['header']['button_link']),
                'categories_menu' => (bool) $s['header']['categories_menu'],
            ],
            'footer' => [...$base['footer'], 'dark' => (bool) $s['footer']['dark'], 'payments' => (bool) $s['footer']['payments']],
            'general' => [
                ...$base['general'],
                'floating_call' => (bool) $s['general']['floating_call'],
                'call_phone' => $str($s['general']['call_phone'] ?? null),
                'animations' => (bool) $s['general']['animations'],
            ],
            'product_card' => $this->cleanCard((array) ($s['product_card'] ?? [])),
            'product_page' => $this->cleanPage((array) ($s['product_page'] ?? [])),
            'listing' => $this->cleanListing((array) ($s['listing'] ?? [])),
            'cart' => $this->cleanCart((array) ($s['cart'] ?? [])),
        ];
    }

    /** @param array<string, mixed> $l @return array<string, mixed> */
    private function cleanListing(array $l): array
    {
        $l = [...self::LISTING_DEFAULTS, ...$l];

        return [
            'columns_desktop' => (int) $l['columns_desktop'],
            'columns_mobile' => (int) $l['columns_mobile'],
            'banner' => (bool) $l['banner'],
            'subcategories' => (string) $l['subcategories'],
            'filters' => (string) $l['filters'],
        ];
    }

    /** @param array<string, mixed> $c @return array<string, mixed> */
    private function cleanCart(array $c): array
    {
        $c = [...self::CART_DEFAULTS, ...$c];

        return [
            'free_shipping_bar' => (bool) $c['free_shipping_bar'],
            'suggestions_enabled' => (bool) $c['suggestions_enabled'],
            'suggestions' => (string) $c['suggestions'],
            'kitchen_notes' => (bool) $c['kitchen_notes'],
        ];
    }

    /** @param array<string, mixed> $c @return array<string, mixed> */
    private function cleanCard(array $c): array
    {
        $c = [...self::CARD_DEFAULTS, ...$c];

        return [
            'image' => (string) $c['image'],
            'show_description' => (bool) $c['show_description'],
            'show_rating' => (bool) $c['show_rating'],
            'button' => (string) $c['button'],
            'border_width' => (int) $c['border_width'],
            'border_color' => $c['border_color'] === null ? null : strtolower((string) $c['border_color']),
            'radius' => (int) $c['radius'],
            'shadow' => (bool) $c['shadow'],
        ];
    }

    /** @param array<string, mixed> $g @return array<string, mixed> */
    private function cleanPage(array $g): array
    {
        $g = [...self::PAGE_DEFAULTS, ...$g];
        $v = [...self::PAGE_DEFAULTS['viewers'], ...(array) $g['viewers']];

        return [
            'gallery' => (string) $g['gallery'],
            'zoom' => (bool) $g['zoom'],
            'description' => (bool) $g['description'],
            'reviews' => (bool) $g['reviews'],
            'whatsapp_ask' => (bool) $g['whatsapp_ask'],
            'related_enabled' => (bool) $g['related_enabled'],
            'related' => (string) $g['related'],
            'sticky_bar' => (bool) $g['sticky_bar'],
            'sticky_buttons' => (string) $g['sticky_buttons'],
            'viewers' => ['enabled' => (bool) $v['enabled'], 'min' => (int) $v['min'], 'max' => (int) $v['max'], 'every' => (int) $v['every']],
        ];
    }
}
