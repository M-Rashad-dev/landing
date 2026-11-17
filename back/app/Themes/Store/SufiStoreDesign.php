<?php

declare(strict_types=1);

namespace App\Themes\Store;

use App\Rules\TenantExists;
use Illuminate\Validation\Rule;

/**
 * «صوفي», the first paid store theme: the base settings plus its own (dark-mode colors, header
 * layout, top bar, floating buttons, offers tab, motion) and 16 home sections. Its inner pages are
 * «أساس»'s, drawn with this theme's colors and font.
 */
final class SufiStoreDesign extends StoreThemeDesign
{
    public const KEY = 'sufi_store';

    public const SECTION_TYPES = [
        'hero', 'marquee', 'categories', 'product_tabs', 'banners', 'countdown', 'featured_product', 'products',
        'video', 'brands', 'story', 'features', 'testimonials', 'gallery', 'faq', 'location',
    ];

    public const MAX_SECTIONS = 30;

    public const DEFAULT_COLORS = ['primary' => '#b9844f', 'secondary' => '#17181c', 'background' => '#faf8f4', 'text' => '#17181c'];

    public const DARK_COLORS = ['primary' => '#d49a60', 'secondary' => '#f2f0ec', 'background' => '#111215', 'text' => '#f2f0ec'];

    public const APPEARANCES = ['light', 'dark', 'system'];

    public const HEADER_LAYOUTS = ['center', 'start', 'end'];

    /** Header height, header logo, footer logo: small / medium / large. */
    public const SIZES = ['sm', 'md', 'lg'];

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public function defaults(?int $logoMediaId = null): array
    {
        $base = self::baseDefaults($logoMediaId);

        return [
            'settings' => [
                ...$base,
                'colors' => self::DEFAULT_COLORS,
                'font' => 'almarai',
                'colors_dark' => self::DARK_COLORS,
                'appearance' => ['default' => 'light', 'toggle' => true],
                'logo_dark_media_id' => null,
                'header' => [...$base['header'], 'layout' => 'center', 'topbar' => true, 'height' => 'md', 'logo_size' => 'md'],
                'footer' => [...$base['footer'], 'logo' => true, 'logo_size' => 'md'],
                'general' => [...$base['general'], 'floating_call' => false, 'call_phone' => null, 'whatsapp_number' => null, 'animations' => true, 'offers_tab' => ['enabled' => false, 'label' => null, 'link' => ['type' => 'offers', 'target_id' => null, 'url' => null]]],
            ],
            'sections' => [
                self::section('hero', ['slides' => [], 'autoplay' => true, 'height' => 'full', 'merge_header' => true, 'shade' => 40, 'kicker' => null]),
                self::section('marquee', ['items' => (array) __('themes/store/sufi.marquee'), 'speed' => 'normal']),
                self::section('categories', ['title' => __('themes/store/sufi.categories_title'), 'description' => null, 'category_ids' => [], 'shape' => 'circle', 'layout' => 'grid', 'columns_desktop' => 6, 'columns_mobile' => 3]),
                self::section('product_tabs', ['title' => __('themes/store/sufi.tabs_title'), 'description' => null, 'limit' => 8, 'tabs' => [
                    ['label' => __('themes/store/sufi.tab_latest'), 'source' => 'latest', 'category_id' => null, 'product_ids' => []],
                    ['label' => __('themes/store/sufi.tab_offers'), 'source' => 'offers', 'category_id' => null, 'product_ids' => []],
                ]]),
                self::section('features', ['title' => null, 'items' => (array) __('design.features')]),
                self::section('testimonials', ['title' => __('design.testimonials_title'), 'source' => 'auto', 'items' => [], 'layout' => 'slider']),
                self::section('faq', ['title' => __('themes/store/sufi.faq_title'), 'text' => null, 'whatsapp_button' => true, 'items' => (array) __('themes/store/sufi.faq_items')]),
            ],
        ];
    }

    /** @param array<string, mixed> $settings @return array<string, mixed> */
    protected function settingsRules(string $p, array $settings): array
    {
        $color = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $phone = ['sometimes', 'nullable', 'string', 'max:30', 'regex:/^[0-9+ ()-]{6,30}$/'];

        return [
            ...$this->baseSettingsRules($p),
            "{$p}.settings.colors_dark.primary" => $color,
            "{$p}.settings.colors_dark.secondary" => $color,
            "{$p}.settings.colors_dark.background" => $color,
            "{$p}.settings.colors_dark.text" => $color,
            "{$p}.settings.appearance.default" => ['required', Rule::in(self::APPEARANCES)],
            "{$p}.settings.appearance.toggle" => ['required', 'boolean'],
            "{$p}.settings.header.layout" => ['required', Rule::in(self::HEADER_LAYOUTS)],
            "{$p}.settings.header.topbar" => ['required', 'boolean'],
            "{$p}.settings.logo_dark_media_id" => ['sometimes', 'nullable', 'integer', TenantExists::table('media')],
            "{$p}.settings.header.height" => ['sometimes', Rule::in(self::SIZES)],
            "{$p}.settings.header.logo_size" => ['sometimes', Rule::in(self::SIZES)],
            "{$p}.settings.footer.logo" => ['sometimes', 'boolean'],
            "{$p}.settings.footer.logo_size" => ['sometimes', Rule::in(self::SIZES)],
            "{$p}.settings.general.call_phone" => $phone,
            "{$p}.settings.general.whatsapp_number" => $phone,
            "{$p}.settings.general.floating_call" => ['required', 'boolean'],
            "{$p}.settings.general.animations" => ['required', 'boolean'],
            "{$p}.settings.general.offers_tab.enabled" => ['required', 'boolean'],
            "{$p}.settings.general.offers_tab.label" => [($settings['general']['offers_tab']['enabled'] ?? false) ? 'required' : 'nullable', 'string', 'max:30'],
            ...StoreSections::linkRules("{$p}.settings.general.offers_tab.link", (array) ($settings['general']['offers_tab']['link'] ?? [])),
        ];
    }

    /** @param array<string, mixed> $s @return array<string, mixed> */
    protected function cleanSettings(array $s): array
    {
        $str = StoreSections::str(...);
        $color = fn (array $c) => array_map(fn ($v) => strtolower((string) $v), array_intersect_key($c, self::DARK_COLORS));
        $base = $this->cleanBaseSettings($s);
        $tab = (array) $s['general']['offers_tab'];

        return [
            ...$base,
            'colors_dark' => $color((array) $s['colors_dark']),
            'appearance' => ['default' => (string) $s['appearance']['default'], 'toggle' => (bool) $s['appearance']['toggle']],
            'logo_dark_media_id' => isset($s['logo_dark_media_id']) ? (int) $s['logo_dark_media_id'] : null,
            'header' => [
                ...$base['header'],
                'layout' => (string) $s['header']['layout'],
                'topbar' => (bool) $s['header']['topbar'],
                'height' => (string) ($s['header']['height'] ?? 'md'),
                'logo_size' => (string) ($s['header']['logo_size'] ?? 'md'),
            ],
            'footer' => [...$base['footer'], 'logo' => (bool) ($s['footer']['logo'] ?? true), 'logo_size' => (string) ($s['footer']['logo_size'] ?? 'md')],
            'general' => [
                ...$base['general'],
                'floating_call' => (bool) $s['general']['floating_call'],
                'call_phone' => $str($s['general']['call_phone'] ?? null),
                'whatsapp_number' => $str($s['general']['whatsapp_number'] ?? null),
                'animations' => (bool) $s['general']['animations'],
                'offers_tab' => ['enabled' => (bool) $tab['enabled'], 'label' => $str($tab['label'] ?? null), 'link' => StoreSections::cleanLink((array) $tab['link'])],
            ],
        ];
    }

    /** «صوفي»'s reviews add a layout: a slider (default) or a grid, on every screen. */
    protected function sectionRules(string $type, string $s, array $props): array
    {
        $rules = parent::sectionRules($type, $s, $props);

        return $type === 'testimonials' ? [...$rules, "{$s}.props.layout" => ['sometimes', Rule::in(['slider', 'list'])]] : $rules;
    }

    protected function cleanSection(string $type, array $p): array
    {
        $clean = parent::cleanSection($type, $p);

        return $type === 'testimonials' ? [...$clean, 'layout' => (string) ($p['layout'] ?? 'slider')] : $clean;
    }
}
