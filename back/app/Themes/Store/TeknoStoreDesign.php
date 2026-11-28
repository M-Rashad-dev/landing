<?php

declare(strict_types=1);

namespace App\Themes\Store;

use App\Rules\TenantExists;
use Illuminate\Validation\Rule;

/**
 * «تيكنو», the electronics store theme (phones, laptops, accessories), built from the owner's approved images
 * (docs/plans/tekno). A dark navy frame with electric blue, cyan and a lime color for installments and savings.
 * The base settings plus: the dark and lime colors, the title font, the button shape; a header with a hotline,
 * «تابع طلبك» and a search with a category select; a footer «المساعدة» column of chosen store pages; the «كل
 * الأقسام» mega menu; its product card (spec chips, «قارن», installment or stock line); and «التقسيط», shown on
 * cards and blocks as an approximate monthly amount (display only, never a way to pay). Its own sections: the
 * opening slider with side tiles, «عرض اليوم» and «الضمان وخدمة ما بعد البيع».
 */
final class TeknoStoreDesign extends StoreThemeDesign
{
    public const KEY = 'tekno_store';

    public const SECTION_TYPES = [
        'tech_hero', 'features', 'categories', 'deal_of_day', 'product_tabs', 'products', 'banners', 'countdown',
        'video', 'brands', 'services', 'testimonials', 'faq', 'cta',
    ];

    public const MAX_SECTIONS = 30;

    public const SETTINGS_GROUPS = ['look', 'header', 'footer', 'general', 'mega_menu', 'product_card', 'installments'];

    public const DEFAULT_COLORS = ['primary' => '#2563eb', 'secondary' => '#22d3ee', 'background' => '#f2f4f8', 'text' => '#0b1220'];

    /** The navy of the header, the hero and the deal. */
    public const DEFAULT_DARK = '#0f1a2e';

    /** The lime of installments, savings and «عروض اليوم». */
    public const DEFAULT_DEAL = '#a3e635';

    public const BUTTONS = ['rounded', 'pill', 'square'];

    /** «قايمة الأقسام الكبيرة»: categories in the side list, link columns per category, links per column. */
    public const MEGA_ITEMS = 10;

    public const MEGA_COLUMNS = 2;

    public const MEGA_LINKS = 8;

    /** The product card (`badge_label`: the spec row drawn as a dark badge on the picture; null: none). */
    public const CARD_DEFAULTS = [
        'show_specs' => true,
        'show_compare' => true,
        'show_rating' => true,
        'show_installment' => true,
        // «فاضل N بس» from this many units down (0: never).
        'low_stock' => 5,
        'badge_label' => null,
        'radius' => 16,
    ];

    /** Months a merchant may offer. */
    public const INSTALLMENT_MONTHS = [3, 6, 9, 12, 18, 24, 36];

    public const INSTALLMENT_PROVIDERS = 6;

    /** «التقسيط»: monthly = ceil(price × (1 + interest / 100) / months), from `min_price` up. */
    public const INSTALLMENTS_DEFAULTS = [
        'enabled' => true,
        'months' => [6, 12, 18, 24],
        'card_months' => 12,
        'interest_percent' => 0,
        'min_price' => 2000,
        'providers' => [],
        'note' => null,
    ];

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public function defaults(?int $logoMediaId = null): array
    {
        $base = self::baseDefaults($logoMediaId);
        $t = fn (string $key) => __('themes/store/tekno.'.$key);
        $all = ['type' => 'all_products', 'target_id' => null, 'url' => null];
        $none = ['type' => 'none', 'target_id' => null, 'url' => null];
        $tab = fn (string $source) => ['label' => (string) $t("tabs.{$source}"), 'source' => $source, 'category_id' => null, 'product_ids' => []];
        $brands = self::section('brands', ['title' => (string) $t('brands.title'), 'items' => array_map(fn (int $n) => ['media_id' => null, 'name' => (string) __('themes/store/tekno.brands.item', ['n' => $n]), 'link' => $none], range(1, 8))]);

        return [
            'settings' => [
                ...$base,
                'colors' => [...self::DEFAULT_COLORS, 'dark' => self::DEFAULT_DARK, 'deal' => self::DEFAULT_DEAL],
                'display_font' => true,
                'button' => 'rounded',
                'header' => [...$base['header'], 'announcement' => (string) $t('announcement'), 'hotline' => null, 'track_link' => true, 'search_categories' => true],
                'footer' => [...$base['footer'], 'help_links' => []],
                'mega_menu' => ['enabled' => true, 'items' => []],
                'product_card' => [...self::CARD_DEFAULTS, 'badge_label' => (string) $t('card.badge_label')],
                'installments' => [...self::INSTALLMENTS_DEFAULTS, 'providers' => (array) $t('installments.providers')],
            ],
            'sections' => [
                self::section('tech_hero', [
                    'slides' => [[
                        'kicker' => (string) $t('hero.kicker'),
                        'title' => (string) $t('hero.title'),
                        'highlight' => (string) $t('hero.highlight'),
                        'subtitle' => null,
                        'media_id' => null,
                        'chips' => (array) $t('hero.chips'),
                        'product_id' => null,
                        'button_label' => (string) $t('hero.button'),
                        'link' => $all,
                        'second_label' => (string) $t('hero.second'),
                        'second_link' => $all,
                    ]],
                    // Each tile opens the store's search for its kicker (headphones, gaming…).
                    'tiles' => array_map(fn (array $x) => ['media_id' => null, 'kicker' => $x['kicker'], 'title' => $x['title'], 'text' => null, 'color' => $x['color'], 'link' => ['type' => 'search', 'target_id' => null, 'url' => $x['kicker']]], (array) $t('hero.tiles')),
                ]),
                self::section('features', ['title' => null, 'items' => (array) $t('trust')]),
                self::section('categories', ['title' => (string) $t('categories_title'), 'description' => null, 'category_ids' => [], 'shape' => 'circle', 'layout' => 'grid', 'columns_desktop' => 8, 'columns_mobile' => 4]),
                // In the order a saved section has it (the starter design saves unchanged).
                self::section('product_tabs', ['title' => (string) $t('tabs.title'), 'description' => null, 'limit' => 10, 'tabs' => [$tab('best_sellers'), $tab('latest'), $tab('offers')], 'kicker' => (string) $t('tabs.kicker')]),
                // Hidden until the merchant puts his own brands (names or logos) in it.
                [...$brands, 'visible' => false],
                self::section('services', ['title' => (string) $t('services.title'), 'items' => (array) $t('services.items')]),
                self::section('testimonials', ['title' => (string) $t('testimonials_title'), 'source' => 'auto', 'items' => []]),
            ],
        ];
    }

    /** @param array<string, mixed> $settings @return array<string, mixed> */
    protected function settingsRules(string $p, array $settings): array
    {
        $text = StoreSections::text(...);
        $months = array_values(array_filter((array) ($settings['installments']['months'] ?? []), 'is_numeric'));

        return [
            ...$this->baseSettingsRules($p),
            "{$p}.settings.colors.dark" => ['required', 'string', StoreSections::HEX],
            "{$p}.settings.colors.deal" => ['required', 'string', StoreSections::HEX],
            "{$p}.settings.display_font" => ['required', 'boolean'],
            "{$p}.settings.button" => ['required', Rule::in(self::BUTTONS)],
            "{$p}.settings.header.hotline" => ['nullable', 'string', 'max:30', 'regex:/^[0-9+ ()-]{3,30}$/'],
            "{$p}.settings.header.track_link" => ['required', 'boolean'],
            "{$p}.settings.header.search_categories" => ['required', 'boolean'],
            "{$p}.settings.footer.help_links" => ['present', 'array', 'max:4'],
            "{$p}.settings.footer.help_links.*" => ['integer', 'distinct', TenantExists::table('store_pages')],
            ...$this->megaMenuRules($p, (array) ($settings['mega_menu'] ?? [])),
            "{$p}.settings.product_card" => ['required', 'array'],
            "{$p}.settings.product_card.show_specs" => ['required', 'boolean'],
            "{$p}.settings.product_card.show_compare" => ['required', 'boolean'],
            "{$p}.settings.product_card.show_rating" => ['required', 'boolean'],
            "{$p}.settings.product_card.show_installment" => ['required', 'boolean'],
            "{$p}.settings.product_card.low_stock" => ['required', 'integer', 'between:0,20'],
            "{$p}.settings.product_card.badge_label" => $text(30),
            "{$p}.settings.product_card.radius" => ['required', 'integer', 'between:0,24'],
            "{$p}.settings.installments" => ['required', 'array'],
            "{$p}.settings.installments.enabled" => ['required', 'boolean'],
            "{$p}.settings.installments.months" => ['required', 'array', 'min:1', 'max:6'],
            "{$p}.settings.installments.months.*" => ['integer', 'distinct', Rule::in(self::INSTALLMENT_MONTHS)],
            "{$p}.settings.installments.card_months" => ['required', 'integer', Rule::in(array_map('intval', $months))],
            "{$p}.settings.installments.interest_percent" => ['required', 'integer', 'between:0,100'],
            "{$p}.settings.installments.min_price" => ['required', 'integer', 'between:0,10000000'],
            "{$p}.settings.installments.providers" => ['present', 'array', 'max:'.self::INSTALLMENT_PROVIDERS],
            "{$p}.settings.installments.providers.*" => $text(30, true),
            "{$p}.settings.installments.note" => $text(120),
        ];
    }

    /**
     * «قايمة الأقسام الكبيرة»: each item is a category of the side list with up to two columns of links and an
     * optional promo card. With no items the menu shows the categories and their sub-categories.
     *
     * @param  array<string, mixed>  $menu
     * @return array<string, mixed>
     */
    private function megaMenuRules(string $p, array $menu): array
    {
        $text = StoreSections::text(...);
        $k = "{$p}.settings.mega_menu";
        $rules = [
            $k => ['required', 'array'],
            "{$k}.enabled" => ['required', 'boolean'],
            "{$k}.items" => ['present', 'array', 'max:'.self::MEGA_ITEMS],
            "{$k}.items.*.category_id" => ['required', 'integer', 'distinct', TenantExists::table('categories')],
            "{$k}.items.*.columns" => ['present', 'array', 'max:'.self::MEGA_COLUMNS],
            "{$k}.items.*.columns.*.title" => $text(30, true),
            "{$k}.items.*.columns.*.links" => ['required', 'array', 'min:1', 'max:'.self::MEGA_LINKS],
            "{$k}.items.*.columns.*.links.*.label" => $text(30, true),
            "{$k}.items.*.promo" => ['nullable', 'array'],
        ];
        foreach (array_values((array) ($menu['items'] ?? [])) as $i => $item) {
            $item = is_array($item) ? $item : [];
            foreach (array_values((array) ($item['columns'] ?? [])) as $c => $column) {
                foreach (array_values(is_array($column) ? (array) ($column['links'] ?? []) : []) as $l => $link) {
                    $rules += StoreSections::linkRules("{$k}.items.{$i}.columns.{$c}.links.{$l}.link", is_array($link) ? (array) ($link['link'] ?? []) : []);
                }
            }
            // The promo card's fields only when it has one (a wildcard would require them under a null promo).
            if (is_array($item['promo'] ?? null)) {
                $promo = "{$k}.items.{$i}.promo";
                $rules += [
                    "{$promo}.media_id" => StoreSections::media(false),
                    "{$promo}.title" => $text(40, true),
                    "{$promo}.text" => $text(40),
                    ...StoreSections::linkRules("{$promo}.link", (array) ($item['promo']['link'] ?? [])),
                ];
            }
        }

        return $rules;
    }

    /** @param array<string, mixed> $s @return array<string, mixed> */
    protected function cleanSettings(array $s): array
    {
        $str = StoreSections::str(...);
        $base = $this->cleanBaseSettings($s);
        $card = (array) $s['product_card'];
        $plan = (array) $s['installments'];
        $months = array_values(array_unique(array_map('intval', (array) $plan['months'])));
        sort($months);

        return [
            ...$base,
            'colors' => [...$base['colors'], 'dark' => strtolower((string) $s['colors']['dark']), 'deal' => strtolower((string) $s['colors']['deal'])],
            'display_font' => (bool) $s['display_font'],
            'button' => (string) $s['button'],
            'header' => [
                ...$base['header'],
                'hotline' => $str($s['header']['hotline'] ?? null),
                'track_link' => (bool) $s['header']['track_link'],
                'search_categories' => (bool) $s['header']['search_categories'],
            ],
            'footer' => [...$base['footer'], 'help_links' => array_values(array_map('intval', (array) $s['footer']['help_links']))],
            'mega_menu' => [
                'enabled' => (bool) $s['mega_menu']['enabled'],
                'items' => array_values(array_map(fn (array $item) => [
                    'category_id' => (int) $item['category_id'],
                    'columns' => array_values(array_map(fn (array $column) => [
                        'title' => (string) $str($column['title']),
                        'links' => array_values(array_map(fn (array $link) => ['label' => (string) $str($link['label']), 'link' => StoreSections::cleanLink((array) $link['link'])], (array) $column['links'])),
                    ], (array) $item['columns'])),
                    'promo' => is_array($item['promo'] ?? null) ? [
                        'media_id' => isset($item['promo']['media_id']) && $item['promo']['media_id'] !== '' ? (int) $item['promo']['media_id'] : null,
                        'title' => (string) $str($item['promo']['title']),
                        'text' => $str($item['promo']['text'] ?? null),
                        'link' => StoreSections::cleanLink((array) $item['promo']['link']),
                    ] : null,
                ], (array) $s['mega_menu']['items'])),
            ],
            'product_card' => [
                'show_specs' => (bool) $card['show_specs'],
                'show_compare' => (bool) $card['show_compare'],
                'show_rating' => (bool) $card['show_rating'],
                'show_installment' => (bool) $card['show_installment'],
                'low_stock' => (int) $card['low_stock'],
                'badge_label' => $str($card['badge_label'] ?? null),
                'radius' => (int) $card['radius'],
            ],
            'installments' => [
                'enabled' => (bool) $plan['enabled'],
                'months' => $months,
                'card_months' => (int) $plan['card_months'],
                'interest_percent' => (int) $plan['interest_percent'],
                'min_price' => (int) $plan['min_price'],
                'providers' => array_values(array_map(fn ($x) => (string) $str($x), (array) $plan['providers'])),
                'note' => $str($plan['note'] ?? null),
            ],
        ];
    }

    /**
     * «تيكنو» extends three library types: the trust strip takes five items and the electronics icons, the
     * product tabs a kicker above their title, and a written review the product it was about («اشترى: …»).
     */
    protected function sectionRules(string $type, string $s, array $props): array
    {
        $rules = parent::sectionRules($type, $s, $props);

        return match ($type) {
            'features' => [...$rules, "{$s}.props.items" => ['required', 'array', 'min:2', 'max:5'], "{$s}.props.items.*.icon" => ['required', Rule::in(StoreSections::TECH_ICONS)]],
            'product_tabs' => [...$rules, "{$s}.props.kicker" => StoreSections::text(40)],
            'testimonials' => [...$rules, "{$s}.props.items.*.product" => StoreSections::text(60)],
            default => $rules,
        };
    }

    protected function cleanSection(string $type, array $p): array
    {
        $clean = parent::cleanSection($type, $p);

        return match ($type) {
            'product_tabs' => [...$clean, 'kicker' => StoreSections::str($p['kicker'] ?? null)],
            'testimonials' => [...$clean, 'items' => array_map(
                fn (array $item, mixed $raw) => [...$item, 'product' => StoreSections::str(is_array($raw) ? ($raw['product'] ?? null) : null)],
                $clean['items'],
                array_values((array) ($p['items'] ?? [])),
            )],
            default => $clean,
        };
    }
}
