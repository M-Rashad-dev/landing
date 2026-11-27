<?php

declare(strict_types=1);

namespace App\Themes\Store;

use App\Themes\Store\Concerns\PageSettingsGroups;
use Illuminate\Validation\Rule;

/**
 * «رواق», the beauty and care store theme (skin care, hair, make-up). Soft pastel bands, a title
 * font, product cards on a tinted plate. The base settings plus: a dark color for the dark bands
 * (the offer, the footer when dark), the title font, the button shape, a header with the logo at
 * the start or in the middle and the categories in it, a light or dark footer with the ways to pay,
 * floating call and motion, and its product card. Its own sections: «البداية» (picture, rating,
 * badge, chips), «اختصارات» (skin types, concerns… each opening a link), «روتين كامل» (2–4
 * products added together), «فيديوهات قصيرة», «المكوّنات» and a WhatsApp band. Its own product,
 * category, cart and checkout pages, with their settings groups (stage 2).
 */
final class RawaqStoreDesign extends StoreThemeDesign
{
    use PageSettingsGroups;

    public const KEY = 'rawaq_store';

    public const SECTION_TYPES = [
        'glow_hero', 'features', 'shortcuts', 'categories', 'product_tabs', 'products', 'routine', 'banners',
        'countdown', 'reels', 'video', 'ingredients', 'brands', 'testimonials', 'faq', 'cta',
        'before_after', 'skin_quiz', 'articles',
    ];

    public const MAX_SECTIONS = 30;

    /** «رواق» draws its product cards and pages its own way, so it has their settings. */
    public const SETTINGS_GROUPS = ['look', 'header', 'footer', 'general', 'product_card', 'product_page', 'listing', 'cart'];

    /** The product card (designs saved before these settings read them). */
    public const CARD_DEFAULTS = [
        // square or tall (4:5) pictures.
        'image' => 'square',
        // The picture on a soft plate of the theme's color.
        'tinted' => true,
        'show_description' => false,
        'show_rating' => true,
        'button' => 'full',
        'radius' => 22,
    ];

    /** The product page (designs saved before these settings read them). */
    public const PAGE_DEFAULTS = [
        'gallery' => 'thumbs',
        'zoom' => true,
        'description' => true,
        'reviews' => true,
        'whatsapp_ask' => true,
        'related_enabled' => true,
        'related' => 'similar',
        'sticky_bar' => true,
        'sticky_buttons' => 'cart',
        'viewers' => ['enabled' => false, 'min' => 40, 'max' => 120, 'every' => 15],
        // Short promises under the buttons («أصلي 100%»، «مرخّص من وزارة الصحة»…).
        'promises' => ['أصلي 100%', 'الدفع عند الاستلام', 'استبدال سهل'],
    ];

    /** Up to this many promises, each this long. */
    public const PROMISES_MAX = 4;

    /** Category, all-products and offers pages (designs saved before these settings read them). */
    public const LISTING_DEFAULTS = [
        'columns_desktop' => 4,
        'columns_mobile' => 2,
        'banner' => true,
        'subcategories' => 'circles',
        'filters' => 'button',
    ];

    /** The cart (designs saved before these settings read them). */
    public const CART_DEFAULTS = [
        'free_shipping_bar' => true,
        'suggestions_enabled' => true,
        'suggestions' => 'offers',
        // «ملاحظة على الطلب»: written in the cart, carried to the checkout's notes.
        'order_notes' => false,
    ];

    public const DEFAULT_COLORS = ['primary' => '#b9507a', 'secondary' => '#3d9a6f', 'background' => '#fbf7f3', 'text' => '#2b2226'];

    /** The background of the dark bands (the offer, the footer when dark). */
    public const DEFAULT_DARK = '#2b2226';

    public const BUTTONS = ['rounded', 'pill', 'square'];

    public const HEADER_LAYOUTS = ['start', 'center'];

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public function defaults(?int $logoMediaId = null): array
    {
        $base = self::baseDefaults($logoMediaId);
        $t = fn (string $key) => __('themes/store/rawaq.'.$key);
        $all = ['type' => 'all_products', 'target_id' => null, 'url' => null];
        $offers = ['type' => 'offers', 'target_id' => null, 'url' => null];
        // In the order a saved tile has (the starter design saves unchanged).
        $tiles = fn (string $key) => array_map(fn (array $item) => ['label' => $item['label'], 'text' => $item['text'], 'media_id' => null, 'color' => $item['color'], 'link' => $all], (array) $t($key));

        return [
            'settings' => [
                ...$base,
                'colors' => [...self::DEFAULT_COLORS, 'dark' => self::DEFAULT_DARK],
                'display_font' => true,
                'button' => 'pill',
                'header' => [...$base['header'], 'announcement' => (string) $t('announcement'), 'layout' => 'start', 'categories_menu' => true],
                'footer' => [...$base['footer'], 'dark' => true, 'payments' => true],
                'general' => [...$base['general'], 'floating_call' => false, 'call_phone' => null, 'animations' => true],
                'product_card' => self::CARD_DEFAULTS,
                'product_page' => self::PAGE_DEFAULTS,
                'listing' => self::LISTING_DEFAULTS,
                'cart' => self::CART_DEFAULTS,
            ],
            'sections' => [
                self::section('glow_hero', [
                    'kicker' => (string) $t('hero.kicker'),
                    'title' => (string) $t('hero.title'),
                    'highlight' => (string) $t('hero.highlight'),
                    'subtitle' => (string) $t('hero.subtitle'),
                    'media_id' => null,
                    'badge' => (string) $t('hero.badge'),
                    'rating' => null,
                    'primary_label' => (string) $t('hero.primary'),
                    'primary_link' => $all,
                    'second_label' => (string) $t('hero.second'),
                    'second_link' => $offers,
                    'chips' => (array) $t('hero.chips'),
                ]),
                self::section('features', ['title' => null, 'items' => (array) $t('trust')]),
                self::section('shortcuts', ['kicker' => (string) $t('skin.kicker'), 'title' => (string) $t('skin.title'), 'description' => null, 'style' => 'circles', 'items' => $tiles('skin.items')]),
                self::section('shortcuts', ['kicker' => (string) $t('concerns.kicker'), 'title' => (string) $t('concerns.title'), 'description' => null, 'style' => 'cards', 'items' => $tiles('concerns.items')]),
                self::section('product_tabs', ['title' => (string) $t('tabs_title'), 'description' => null, 'limit' => 8, 'tabs' => [
                    ['label' => (string) $t('tab_latest'), 'source' => 'latest', 'category_id' => null, 'product_ids' => []],
                    ['label' => (string) $t('tab_offers'), 'source' => 'offers', 'category_id' => null, 'product_ids' => []],
                ]]),
                // Each ingredient opens the store's search for its name (the products that have it).
                self::section('ingredients', ['kicker' => (string) $t('ingredients.kicker'), 'title' => (string) $t('ingredients.title'), 'description' => null, 'items' => array_map(fn (array $item) => [...$item, 'link' => ['type' => 'search', 'target_id' => null, 'url' => $item['name']]], (array) $t('ingredients.items'))]),
                self::section('skin_quiz', self::starterQuiz()),
                self::section('testimonials', ['title' => (string) $t('testimonials_title'), 'source' => 'auto', 'items' => []]),
                self::section('cta', ['title' => (string) $t('cta.title'), 'text' => (string) $t('cta.text'), 'button_label' => (string) $t('cta.button'), 'action' => 'whatsapp', 'message' => (string) $t('cta.message'), 'link' => ['type' => 'none', 'target_id' => null, 'url' => null]]),
            ],
        ];
    }

    /**
     * The ready «اختبار البشرة» (4 skin types, 5 questions): the merchant only picks each result's
     * products, and edits the rest if she likes.
     *
     * @return array<string, mixed>
     */
    public static function starterQuiz(): array
    {
        $q = (array) __('themes/store/rawaq.quiz');

        return [
            'kicker' => (string) $q['kicker'],
            'title' => (string) $q['title'],
            'text' => (string) $q['text'],
            'button_label' => (string) $q['button'],
            'results' => array_map(fn (array $r) => ['id' => $r['id'], 'name' => $r['name'], 'text' => $r['text'], 'product_ids' => [], 'category_id' => null], (array) $q['results']),
            'questions' => (array) $q['questions'],
            'ai' => StoreSections::QUIZ_AI_DEFAULTS,
        ];
    }

    /** @param array<string, mixed> $settings @return array<string, mixed> */
    protected function settingsRules(string $p, array $settings): array
    {
        return [
            ...$this->baseSettingsRules($p),
            "{$p}.settings.colors.dark" => ['required', 'string', StoreSections::HEX],
            "{$p}.settings.display_font" => ['required', 'boolean'],
            "{$p}.settings.button" => ['required', Rule::in(self::BUTTONS)],
            "{$p}.settings.header.layout" => ['required', Rule::in(self::HEADER_LAYOUTS)],
            "{$p}.settings.header.categories_menu" => ['required', 'boolean'],
            "{$p}.settings.footer.dark" => ['required', 'boolean'],
            "{$p}.settings.footer.payments" => ['required', 'boolean'],
            "{$p}.settings.general.floating_call" => ['required', 'boolean'],
            "{$p}.settings.general.call_phone" => ['nullable', 'string', 'max:30', 'regex:/^[0-9+ ()-]{6,30}$/'],
            "{$p}.settings.general.animations" => ['required', 'boolean'],
            // Missing in designs saved before it: its defaults are used.
            "{$p}.settings.product_card" => ['sometimes', 'array'],
            "{$p}.settings.product_card.image" => ['sometimes', Rule::in(['square', 'tall'])],
            "{$p}.settings.product_card.tinted" => ['sometimes', 'boolean'],
            "{$p}.settings.product_card.show_description" => ['sometimes', 'boolean'],
            "{$p}.settings.product_card.show_rating" => ['sometimes', 'boolean'],
            "{$p}.settings.product_card.button" => ['sometimes', Rule::in(['icon', 'full'])],
            "{$p}.settings.product_card.radius" => ['sometimes', 'integer', 'between:0,40'],
            ...$this->productPageRules($p),
            "{$p}.settings.product_page.promises" => ['sometimes', 'array', 'max:'.self::PROMISES_MAX],
            "{$p}.settings.product_page.promises.*" => StoreSections::text(40, true),
            ...$this->listingRules($p),
            ...$this->cartRules($p, 'order_notes'),
        ];
    }

    /** @param array<string, mixed> $s @return array<string, mixed> */
    protected function cleanSettings(array $s): array
    {
        $base = $this->cleanBaseSettings($s);
        $card = [...self::CARD_DEFAULTS, ...(array) ($s['product_card'] ?? [])];

        return [
            ...$base,
            'colors' => [...$base['colors'], 'dark' => strtolower((string) $s['colors']['dark'])],
            'display_font' => (bool) $s['display_font'],
            'button' => (string) $s['button'],
            'header' => [...$base['header'], 'layout' => (string) $s['header']['layout'], 'categories_menu' => (bool) $s['header']['categories_menu']],
            'footer' => [...$base['footer'], 'dark' => (bool) $s['footer']['dark'], 'payments' => (bool) $s['footer']['payments']],
            'general' => [
                ...$base['general'],
                'floating_call' => (bool) $s['general']['floating_call'],
                'call_phone' => StoreSections::str($s['general']['call_phone'] ?? null),
                'animations' => (bool) $s['general']['animations'],
            ],
            'product_card' => [
                'image' => (string) $card['image'],
                'tinted' => (bool) $card['tinted'],
                'show_description' => (bool) $card['show_description'],
                'show_rating' => (bool) $card['show_rating'],
                'button' => (string) $card['button'],
                'radius' => (int) $card['radius'],
            ],
            'product_page' => [
                ...$this->cleanProductPage((array) ($s['product_page'] ?? []), self::PAGE_DEFAULTS),
                'promises' => array_values(array_map(fn ($x) => (string) StoreSections::str($x), (array) ($s['product_page']['promises'] ?? self::PAGE_DEFAULTS['promises']))),
            ],
            'listing' => $this->cleanListing((array) ($s['listing'] ?? []), self::LISTING_DEFAULTS),
            'cart' => $this->cleanCart((array) ($s['cart'] ?? []), self::CART_DEFAULTS, 'order_notes'),
        ];
    }
}
