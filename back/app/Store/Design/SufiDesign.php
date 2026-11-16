<?php

declare(strict_types=1);

namespace App\Store\Design;

use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * «صوفي», the first paid store theme: the settings of «أساس» plus its own (dark-mode colors,
 * header layout, top bar, floating buttons, offers tab, motion) and 16 home sections. The inner
 * pages keep the shared store pages, drawn with this theme's colors and font.
 */
final class SufiDesign
{
    public const KEY = 'sufi';

    public const SECTION_TYPES = [
        'hero', 'marquee', 'categories', 'product_tabs', 'banners', 'countdown', 'featured_product', 'products',
        'video', 'brands', 'story', 'features', 'testimonials', 'gallery', 'faq', 'location',
    ];

    public const MAX_SECTIONS = 30;

    public const DEFAULT_COLORS = ['primary' => '#b9844f', 'secondary' => '#17181c', 'background' => '#faf8f4', 'text' => '#17181c'];

    public const DARK_COLORS = ['primary' => '#d49a60', 'secondary' => '#f2f0ec', 'background' => '#111215', 'text' => '#f2f0ec'];

    public const APPEARANCES = ['light', 'dark', 'system'];

    public const HEADER_LAYOUTS = ['center', 'start', 'end'];

    public const HERO_HEIGHTS = ['full', 'large', 'medium'];

    public const TAB_SOURCES = ['latest', 'offers', 'category', 'manual'];

    public const MARQUEE_SPEEDS = ['slow', 'normal', 'fast'];

    public const CATEGORY_SHAPES = ['circle', 'square', 'card'];

    public function __construct(private readonly AsasDesign $asas) {}

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public static function defaults(?int $logoMediaId = null): array
    {
        $base = AsasDesign::defaults($logoMediaId)['settings'];
        $features = (array) __('design.features');

        return [
            'settings' => [
                ...$base,
                'colors' => self::DEFAULT_COLORS,
                'font' => 'almarai',
                'colors_dark' => self::DARK_COLORS,
                'appearance' => ['default' => 'light', 'toggle' => true],
                'header' => [...$base['header'], 'layout' => 'center', 'topbar' => true],
                'general' => [...$base['general'], 'floating_call' => false, 'animations' => true, 'offers_tab' => ['enabled' => false, 'label' => null, 'link' => ['type' => 'offers', 'target_id' => null, 'url' => null]]],
            ],
            'sections' => [
                self::section('hero', ['slides' => [], 'autoplay' => true, 'height' => 'full', 'merge_header' => true, 'shade' => 40, 'kicker' => null]),
                self::section('marquee', ['items' => (array) __('sufi.marquee'), 'speed' => 'normal']),
                self::section('categories', ['title' => __('sufi.categories_title'), 'description' => null, 'category_ids' => [], 'shape' => 'circle', 'layout' => 'grid', 'columns_desktop' => 6, 'columns_mobile' => 3]),
                self::section('product_tabs', ['title' => __('sufi.tabs_title'), 'description' => null, 'limit' => 8, 'tabs' => [
                    ['label' => __('sufi.tab_latest'), 'source' => 'latest', 'category_id' => null, 'product_ids' => []],
                    ['label' => __('sufi.tab_offers'), 'source' => 'offers', 'category_id' => null, 'product_ids' => []],
                ]]),
                self::section('features', ['title' => null, 'items' => $features]),
                self::section('testimonials', ['title' => __('design.testimonials_title'), 'source' => 'auto', 'items' => []]),
                self::section('faq', ['title' => __('sufi.faq_title'), 'text' => null, 'whatsapp_button' => true, 'items' => (array) __('sufi.faq_items')]),
            ],
        ];
    }

    /** @param array<string, mixed> $props @return array<string, mixed> */
    public static function section(string $type, array $props): array
    {
        return ['id' => substr(bin2hex(random_bytes(6)), 0, 12), 'type' => $type, 'visible' => true, 'props' => $props];
    }

    /**
     * Validates a design sent by the Builder and returns it cleaned (only known keys).
     *
     * @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>}
     *
     * @throws ValidationException
     */
    public function validate(mixed $design, string $prefix = 'draft'): array
    {
        $data = [$prefix => is_array($design) ? $design : []];
        $rules = $this->rules($data[$prefix], $prefix);
        $validator = Validator::make($data, $rules, [], AsasDesign::attributeNames(array_keys($rules)));
        $validator->after(function ($v) use ($data, $prefix): void {
            $seen = [];
            foreach (array_values((array) ($data[$prefix]['sections'] ?? [])) as $i => $section) {
                $id = is_array($section) ? ($section['id'] ?? null) : null;
                if (is_string($id) && isset($seen[$id])) {
                    $v->errors()->add("{$prefix}.sections.{$i}.id", __('design.duplicate_section'));
                }
                $seen[(string) $id] = true;
            }
        });
        $validator->validate();

        return $this->clean($validator->validated()[$prefix]);
    }

    /** @param array<string, mixed> $design @return array<string, mixed> */
    private function rules(array $design, string $p): array
    {
        $text = AsasDesign::textRule(...);
        $color = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $settings = (array) ($design['settings'] ?? []);

        $rules = [
            $p => ['required', 'array'],
            ...$this->asas->settingsRules($p),
            "{$p}.settings.colors_dark.primary" => $color,
            "{$p}.settings.colors_dark.secondary" => $color,
            "{$p}.settings.colors_dark.background" => $color,
            "{$p}.settings.colors_dark.text" => $color,
            "{$p}.settings.appearance.default" => ['required', Rule::in(self::APPEARANCES)],
            "{$p}.settings.appearance.toggle" => ['required', 'boolean'],
            "{$p}.settings.header.layout" => ['required', Rule::in(self::HEADER_LAYOUTS)],
            "{$p}.settings.header.topbar" => ['required', 'boolean'],
            "{$p}.settings.general.floating_call" => ['required', 'boolean'],
            "{$p}.settings.general.animations" => ['required', 'boolean'],
            "{$p}.settings.general.offers_tab.enabled" => ['required', 'boolean'],
            "{$p}.settings.general.offers_tab.label" => [($settings['general']['offers_tab']['enabled'] ?? false) ? 'required' : 'nullable', 'string', 'max:30'],
            ...$this->linkRules("{$p}.settings.general.offers_tab.link", (array) ($settings['general']['offers_tab']['link'] ?? [])),
            "{$p}.sections" => ['present', 'array', 'max:'.self::MAX_SECTIONS],
        ];

        foreach (array_values((array) ($design['sections'] ?? [])) as $i => $section) {
            $s = "{$p}.sections.{$i}";
            $rules["{$s}.id"] = ['required', 'string', 'regex:/^[A-Za-z0-9_-]{6,40}$/'];
            $rules["{$s}.type"] = ['required', Rule::in(self::SECTION_TYPES)];
            $rules["{$s}.visible"] = ['required', 'boolean'];
            $rules["{$s}.props"] = ['required', 'array'];
            $props = (array) ($section['props'] ?? []);
            $media = fn (bool $required = true) => [$required ? 'required' : 'nullable', 'integer', TenantExists::table('media')];

            $rules += match (is_array($section) ? ($section['type'] ?? null) : null) {
                'hero' => [
                    ...$this->asas->bannerRules($s, $props, $text),
                    "{$s}.props.height" => ['required', Rule::in(self::HERO_HEIGHTS)],
                    "{$s}.props.merge_header" => ['required', 'boolean'],
                    "{$s}.props.shade" => ['required', 'integer', 'between:0,80'],
                    "{$s}.props.kicker" => $text(40),
                ],
                'marquee' => [
                    "{$s}.props.items" => ['required', 'array', 'min:1', 'max:10'],
                    "{$s}.props.items.*" => $text(60, true),
                    "{$s}.props.speed" => ['required', Rule::in(self::MARQUEE_SPEEDS)],
                ],
                'categories' => [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.description" => $text(200),
                    "{$s}.props.category_ids" => ['present', 'array', 'max:24'],
                    "{$s}.props.category_ids.*" => ['integer', 'distinct', TenantExists::table('categories')],
                    "{$s}.props.shape" => ['required', Rule::in(self::CATEGORY_SHAPES)],
                    "{$s}.props.layout" => ['required', Rule::in(['grid', 'slider'])],
                    "{$s}.props.columns_desktop" => ['required', 'integer', 'between:3,8'],
                    "{$s}.props.columns_mobile" => ['required', 'integer', 'between:2,4'],
                ],
                'product_tabs' => $this->tabsRules($s, $props, $text),
                'banners' => [
                    "{$s}.props.items" => ['required', 'array', 'min:1', 'max:3'],
                    ...$this->itemsWithLinks($s, $props, fn (string $k) => [
                        "{$k}.media_id" => $media(),
                        "{$k}.kicker" => $text(40),
                        "{$k}.title" => $text(80),
                        "{$k}.button_label" => $text(30),
                    ]),
                ],
                'countdown' => [
                    "{$s}.props.media_id" => $media(false),
                    "{$s}.props.kicker" => $text(40),
                    "{$s}.props.title" => $text(80, true),
                    "{$s}.props.text" => $text(200),
                    "{$s}.props.button_label" => $text(30),
                    ...$this->linkRules("{$s}.props.link", (array) ($props['link'] ?? [])),
                    "{$s}.props.ends_at" => ['required', 'date'],
                    "{$s}.props.on_end" => ['required', Rule::in(['hide', 'ended'])],
                ],
                'featured_product' => [
                    "{$s}.props.product_id" => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
                    "{$s}.props.kicker" => $text(40),
                ],
                'products' => $this->asas->productsRules($s, $props, $text),
                'video' => [
                    "{$s}.props.url" => ['required', 'string', 'max:300', new SafeUrl, 'regex:#^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/#i'],
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.text" => $text(200),
                    "{$s}.props.cover_media_id" => $media(false),
                ],
                'brands' => [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.items" => ['required', 'array', 'min:2', 'max:16'],
                    ...$this->itemsWithLinks($s, $props, fn (string $k) => [
                        "{$k}.media_id" => $media(),
                        "{$k}.name" => $text(40),
                    ]),
                ],
                'story' => [
                    "{$s}.props.kicker" => $text(40),
                    "{$s}.props.title" => $text(80, true),
                    "{$s}.props.text" => $text(800),
                    "{$s}.props.media_id" => $media(),
                    "{$s}.props.media2_id" => $media(false),
                    "{$s}.props.stats" => ['present', 'array', 'max:3'],
                    "{$s}.props.stats.*.value" => $text(12, true),
                    "{$s}.props.stats.*.label" => $text(30, true),
                    "{$s}.props.button_label" => $text(30),
                    ...$this->linkRules("{$s}.props.link", (array) ($props['link'] ?? [])),
                ],
                'features' => $this->asas->featuresRules($s, $text),
                'testimonials' => $this->asas->testimonialsRules($s, $props, $text),
                'gallery' => [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.description" => $text(200),
                    "{$s}.props.items" => ['required', 'array', 'min:3', 'max:12'],
                    ...$this->itemsWithLinks($s, $props, fn (string $k) => [
                        "{$k}.media_id" => $media(),
                        "{$k}.label" => $text(60),
                    ]),
                ],
                'faq' => [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.text" => $text(300),
                    "{$s}.props.whatsapp_button" => ['required', 'boolean'],
                    "{$s}.props.items" => ['required', 'array', 'min:1', 'max:20'],
                    "{$s}.props.items.*.question" => $text(160, true),
                    "{$s}.props.items.*.answer" => $text(1000, true),
                ],
                'location' => [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.description" => $text(200),
                    "{$s}.props.branches" => ['required', 'array', 'min:1', 'max:6'],
                    "{$s}.props.branches.*.name" => $text(60, true),
                    "{$s}.props.branches.*.address" => $text(200, true),
                    "{$s}.props.branches.*.hours" => $text(60),
                    "{$s}.props.branches.*.phone" => $text(30),
                    "{$s}.props.branches.*.map_url" => ['required', 'string', 'max:500', new SafeUrl, 'regex:#^https://(www\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)#i'],
                ],
                default => [],
            };
        }

        return $rules;
    }

    /** @param array<string, mixed> $props @return array<string, mixed> */
    private function tabsRules(string $s, array $props, \Closure $text): array
    {
        $rules = [
            "{$s}.props.title" => $text(80),
            "{$s}.props.description" => $text(200),
            "{$s}.props.limit" => ['required', 'integer', Rule::in(AsasDesign::PRODUCT_LIMITS)],
            "{$s}.props.tabs" => ['required', 'array', 'min:1', 'max:6'],
        ];
        foreach (array_values((array) ($props['tabs'] ?? [])) as $j => $tab) {
            $k = "{$s}.props.tabs.{$j}";
            $source = is_array($tab) ? ($tab['source'] ?? null) : null;
            $rules += [
                "{$k}.label" => $text(30, true),
                "{$k}.source" => ['required', Rule::in(self::TAB_SOURCES)],
                "{$k}.category_id" => [$source === 'category' ? 'required' : 'nullable', 'integer', TenantExists::table('categories')],
                "{$k}.product_ids" => [$source === 'manual' ? 'required' : 'present', 'array', $source === 'manual' ? 'min:1' : 'min:0', 'max:24'],
                "{$k}.product_ids.*" => ['integer', 'distinct', TenantExists::table('products')->ignoreTrashed()],
            ];
        }

        return $rules;
    }

    /**
     * Rules of a list of items that each carry a link.
     *
     * @param  array<string, mixed>  $props
     * @param  \Closure(string): array<string, mixed>  $item
     * @return array<string, mixed>
     */
    private function itemsWithLinks(string $s, array $props, \Closure $item): array
    {
        $rules = [];
        foreach (array_values((array) ($props['items'] ?? [])) as $j => $row) {
            $k = "{$s}.props.items.{$j}";
            $rules += $item($k) + $this->linkRules("{$k}.link", is_array($row) ? (array) ($row['link'] ?? []) : []);
        }

        return $rules;
    }

    /** @param array<string, mixed> $link @return array<string, mixed> */
    private function linkRules(string $k, array $link): array
    {
        $type = $link['type'] ?? 'none';

        return [
            "{$k}.type" => ['required', Rule::in(AsasDesign::LINK_TYPES)],
            "{$k}.target_id" => match ($type) {
                'category' => ['required', 'integer', TenantExists::table('categories')],
                'product' => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
                default => ['nullable'],
            },
            "{$k}.url" => $type === 'url' ? ['required', 'string', 'max:500', new SafeUrl] : ['nullable'],
        ];
    }

    /**
     * @param  array<string, mixed>  $d
     * @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    private function clean(array $d): array
    {
        $s = (array) $d['settings'];
        $str = AsasDesign::str(...);
        $color = fn (array $c) => array_map(fn ($v) => strtolower((string) $v), array_intersect_key($c, self::DARK_COLORS));
        $base = $this->asas->cleanSettings($s);
        $tab = (array) $s['general']['offers_tab'];

        $settings = [
            ...$base,
            'colors_dark' => $color((array) $s['colors_dark']),
            'appearance' => ['default' => (string) $s['appearance']['default'], 'toggle' => (bool) $s['appearance']['toggle']],
            'header' => [...$base['header'], 'layout' => (string) $s['header']['layout'], 'topbar' => (bool) $s['header']['topbar']],
            'general' => [
                ...$base['general'],
                'floating_call' => (bool) $s['general']['floating_call'],
                'animations' => (bool) $s['general']['animations'],
                'offers_tab' => ['enabled' => (bool) $tab['enabled'], 'label' => $str($tab['label'] ?? null), 'link' => AsasDesign::cleanLink((array) $tab['link'])],
            ],
        ];

        $sections = [];
        foreach (array_values((array) $d['sections']) as $section) {
            $sections[] = ['id' => (string) $section['id'], 'type' => (string) $section['type'], 'visible' => (bool) $section['visible'], 'props' => $this->cleanProps((string) $section['type'], (array) $section['props'])];
        }

        return ['settings' => $settings, 'sections' => $sections];
    }

    /** @param array<string, mixed> $p @return array<string, mixed> */
    private function cleanProps(string $type, array $p): array
    {
        $str = AsasDesign::str(...);
        $mediaOrNull = fn (mixed $v): ?int => $v === null || $v === '' ? null : (int) $v;
        $items = fn (\Closure $map) => array_values(array_map($map, (array) ($p['items'] ?? [])));

        return match ($type) {
            'hero' => [
                ...$this->asas->cleanProps('banner', $p),
                'height' => (string) $p['height'],
                'merge_header' => (bool) $p['merge_header'],
                'shade' => (int) $p['shade'],
                'kicker' => $str($p['kicker'] ?? null),
            ],
            'marquee' => ['items' => array_values(array_map(fn ($t) => (string) $str($t), (array) $p['items'])), 'speed' => (string) $p['speed']],
            'categories' => [
                'title' => $str($p['title'] ?? null),
                'description' => $str($p['description'] ?? null),
                'category_ids' => array_values(array_map('intval', (array) $p['category_ids'])),
                'shape' => (string) $p['shape'],
                'layout' => (string) $p['layout'],
                'columns_desktop' => (int) $p['columns_desktop'],
                'columns_mobile' => (int) $p['columns_mobile'],
            ],
            'product_tabs' => [
                'title' => $str($p['title'] ?? null),
                'description' => $str($p['description'] ?? null),
                'limit' => (int) $p['limit'],
                'tabs' => array_values(array_map(fn (array $t) => [
                    'label' => (string) $str($t['label']),
                    'source' => (string) $t['source'],
                    'category_id' => $t['source'] === 'category' ? (int) $t['category_id'] : null,
                    'product_ids' => $t['source'] === 'manual' ? array_values(array_map('intval', (array) $t['product_ids'])) : [],
                ], (array) $p['tabs'])),
            ],
            'banners' => ['items' => $items(fn (array $i) => [
                'media_id' => (int) $i['media_id'],
                'kicker' => $str($i['kicker'] ?? null),
                'title' => $str($i['title'] ?? null),
                'button_label' => $str($i['button_label'] ?? null),
                'link' => AsasDesign::cleanLink((array) $i['link']),
            ])],
            'countdown' => [
                'media_id' => $mediaOrNull($p['media_id'] ?? null),
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'text' => $str($p['text'] ?? null),
                'button_label' => $str($p['button_label'] ?? null),
                'link' => AsasDesign::cleanLink((array) $p['link']),
                // Stored in UTC; the Builder sends the merchant's local time with its offset.
                'ends_at' => Carbon::parse((string) $p['ends_at'])->utc()->toIso8601ZuluString(),
                'on_end' => (string) $p['on_end'],
            ],
            'featured_product' => ['product_id' => (int) $p['product_id'], 'kicker' => $str($p['kicker'] ?? null)],
            'products', 'features', 'testimonials' => $this->asas->cleanProps($type, $p),
            'video' => [
                'url' => trim((string) $p['url']),
                'title' => $str($p['title'] ?? null),
                'text' => $str($p['text'] ?? null),
                'cover_media_id' => $mediaOrNull($p['cover_media_id'] ?? null),
            ],
            'brands' => ['title' => $str($p['title'] ?? null), 'items' => $items(fn (array $i) => ['media_id' => (int) $i['media_id'], 'name' => $str($i['name'] ?? null), 'link' => AsasDesign::cleanLink((array) $i['link'])])],
            'story' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'text' => $str($p['text'] ?? null),
                'media_id' => (int) $p['media_id'],
                'media2_id' => $mediaOrNull($p['media2_id'] ?? null),
                'stats' => array_values(array_map(fn (array $x) => ['value' => (string) $str($x['value']), 'label' => (string) $str($x['label'])], (array) $p['stats'])),
                'button_label' => $str($p['button_label'] ?? null),
                'link' => AsasDesign::cleanLink((array) $p['link']),
            ],
            'gallery' => [
                'title' => $str($p['title'] ?? null),
                'description' => $str($p['description'] ?? null),
                'items' => $items(fn (array $i) => ['media_id' => (int) $i['media_id'], 'label' => $str($i['label'] ?? null), 'link' => AsasDesign::cleanLink((array) $i['link'])]),
            ],
            'faq' => [
                'title' => $str($p['title'] ?? null),
                'text' => $str($p['text'] ?? null),
                'whatsapp_button' => (bool) $p['whatsapp_button'],
                'items' => $items(fn (array $i) => ['question' => (string) $str($i['question']), 'answer' => (string) $str($i['answer'])]),
            ],
            'location' => [
                'title' => $str($p['title'] ?? null),
                'description' => $str($p['description'] ?? null),
                'branches' => array_values(array_map(fn (array $b) => [
                    'name' => (string) $str($b['name']),
                    'address' => (string) $str($b['address']),
                    'hours' => $str($b['hours'] ?? null),
                    'phone' => $str($b['phone'] ?? null),
                    'map_url' => trim((string) $b['map_url']),
                ], (array) $p['branches'])),
            ],
        };
    }
}
