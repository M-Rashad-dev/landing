<?php

declare(strict_types=1);

namespace App\Themes\Landing;

use App\Models\AiSection;
use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * «صوفي», the luxury landing theme: one premium product (perfume, watch, bag, outfit, device…)
 * sold through one order form, with calm sections that make it look worth its price (details
 * with pictures, specifications, numbers, packs tied to the product's offers, a countdown…).
 * The visitor can switch it to dark mode, in colors the merchant picks for both. Same contract as
 * the other landing themes (LandingContent): unknown keys dropped, texts trimmed, one order form.
 */
final class SufiLandingDesign implements LandingThemeDesign
{
    use LandingContent;

    public const KEY = 'sufi_landing';

    public const SECTION_TYPES = [
        'hero', 'marquee', 'features', 'details', 'specs', 'gallery', 'video', 'bundles',
        'stats', 'testimonials', 'countdown', 'order_form', 'promises', 'faq',
    ];

    public const MAX_SECTIONS = 20;

    public const ICONS = [
        ...BidayaLandingDesign::ICONS,
        'gem', 'crown', 'award', 'feather', 'droplet', 'sparkle', 'ruler', 'layers', 'leaf', 'palette', 'watch', 'badge',
    ];

    public const HERO_LAYOUTS = ['split', 'cover'];

    public const APPEARANCES = ['light', 'dark', 'system'];

    public const DEFAULT_COLORS = ['primary' => '#b9844f', 'secondary' => '#17181c', 'background' => '#faf8f4', 'text' => '#17181c'];

    public const DARK_COLORS = ['primary' => '#d49a60', 'secondary' => '#f2f0ec', 'background' => '#111215', 'text' => '#f2f0ec'];

    private const VIDEO_HOSTS = '#^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/#i';

    /** @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public static function defaults(?string $productName = null): array
    {
        $t = fn (string $key) => __('themes/landing/sufi.'.$key);

        return [
            'version' => 1,
            'settings' => [
                'colors' => self::DEFAULT_COLORS,
                'colors_dark' => self::DARK_COLORS,
                'appearance' => ['default' => 'light', 'toggle' => true],
                'font' => 'almarai',
                'font_size' => 'medium',
                'button' => 'pill',
                'display_font' => true,
                'logo_media_id' => null,
                'logo_dark_media_id' => null,
                'header' => ['show' => true, 'announcement' => (string) $t('announcement'), 'button_label' => (string) $t('order_now')],
                'footer' => ['text' => null, 'phone' => null, 'whatsapp' => null, 'social' => array_fill_keys(BidayaLandingDesign::SOCIAL, null)],
                'general' => ['sticky_order_button' => true, 'whatsapp_button' => false, 'animations' => true],
            ],
            'sections' => [
                self::section('hero', [
                    'layout' => 'split',
                    'kicker' => (string) $t('hero.kicker'),
                    'title' => $productName ?? (string) $t('hero.title'),
                    'highlight' => null,
                    'subtitle' => (string) $t('hero.subtitle'),
                    'image_media_id' => null,
                    'show_price' => true,
                    'show_rating' => true,
                    'button_label' => (string) $t('order_now'),
                    'second_label' => (string) $t('hero.second'),
                    'badges' => (array) $t('hero.badges'),
                ]),
                self::section('marquee', ['items' => (array) $t('marquee')]),
                self::section('features', ['kicker' => (string) $t('features.kicker'), 'title' => (string) $t('features.title'), 'subtitle' => null, 'items' => (array) $t('features.items')]),
                self::section('details', ['kicker' => (string) $t('details.kicker'), 'title' => (string) $t('details.title'), 'rows' => array_map(fn (array $r) => ['image_media_id' => null] + $r, (array) $t('details.rows'))]),
                self::section('specs', ['kicker' => null, 'title' => (string) $t('specs.title'), 'image_media_id' => null, 'rows' => (array) $t('specs.rows'), 'note' => null]),
                self::section('gallery', ['kicker' => null, 'title' => (string) $t('gallery_title'), 'image_media_ids' => []]),
                self::section('bundles', ['kicker' => null, 'title' => (string) $t('bundles_title'), 'subtitle' => null, 'cards' => []]),
                self::section('testimonials', ['kicker' => null, 'title' => (string) $t('testimonials_title'), 'source' => 'auto', 'items' => [], 'show_score' => true]),
                self::section('order_form', self::orderFormDefaults()),
                self::section('promises', ['items' => (array) $t('promises')]),
                self::section('faq', ['kicker' => null, 'title' => (string) $t('faq_title'), 'items' => (array) $t('faq')]),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function orderFormDefaults(): array
    {
        return [
            'kicker' => (string) __('themes/landing/sufi.form.kicker'),
            'title' => (string) __('themes/landing/sufi.form.title'),
            'subtitle' => (string) __('themes/landing/sufi.form.subtitle'),
            'button_label' => (string) __('themes/landing/sufi.form.button'),
            'fields' => self::fields([]),
            'offer_picker' => true,
            'show_quantity' => true,
            'points' => (array) __('themes/landing/sufi.form.points'),
            'image_media_id' => null,
        ];
    }

    public function validate(mixed $content, string $prefix = 'content'): array
    {
        $names = (array) __('design.attributes') + (array) __('themes/landing/bidaya.attributes') + (array) __('themes/landing/shabe.attributes') + (array) __('themes/landing/sufi.attributes');
        $aiSections = self::loadAiSections(is_array($content) ? $content : []);

        return self::checked(
            $content,
            $prefix,
            fn (array $c, string $p) => $this->rules($c, $p, $aiSections),
            $names,
            fn (array $d) => $this->clean($d, $aiSections),
        );
    }

    /**
     * @param  array<string, mixed>  $content
     * @param  Collection<int, AiSection>  $aiSections
     * @return array<string, mixed>
     */
    private function rules(array $content, string $p, Collection $aiSections): array
    {
        $text = fn (int $max, bool $required = false) => [$required ? 'required' : 'nullable', 'string', 'max:'.$max];
        $color = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $media = ['nullable', 'integer', TenantExists::table('media')];
        $icon = ['required', Rule::in(self::ICONS)];

        $rules = [
            $p => ['required', 'array'],
            "{$p}.settings" => ['required', 'array'],
            "{$p}.settings.appearance.default" => ['required', Rule::in(self::APPEARANCES)],
            "{$p}.settings.appearance.toggle" => ['required', 'boolean'],
            "{$p}.settings.font" => ['required', Rule::in((array) config('landing.fonts'))],
            "{$p}.settings.font_size" => ['required', Rule::in(BidayaLandingDesign::FONT_SIZES)],
            "{$p}.settings.button" => ['required', Rule::in(BidayaLandingDesign::BUTTONS)],
            "{$p}.settings.display_font" => ['required', 'boolean'],
            "{$p}.settings.logo_media_id" => $media,
            "{$p}.settings.logo_dark_media_id" => $media,
            "{$p}.settings.header.show" => ['required', 'boolean'],
            "{$p}.settings.header.announcement" => $text(200),
            "{$p}.settings.header.button_label" => $text(40),
            "{$p}.settings.footer.text" => $text(300),
            "{$p}.settings.footer.phone" => $text(30),
            "{$p}.settings.footer.whatsapp" => $text(30),
            "{$p}.settings.general.sticky_order_button" => ['required', 'boolean'],
            "{$p}.settings.general.whatsapp_button" => ['required', 'boolean'],
            "{$p}.settings.general.animations" => ['required', 'boolean'],
            "{$p}.sections" => ['required', 'array', 'min:1', 'max:'.self::MAX_SECTIONS],
        ];
        foreach (array_keys(self::DEFAULT_COLORS) as $key) {
            $rules["{$p}.settings.colors.{$key}"] = $color;
            $rules["{$p}.settings.colors_dark.{$key}"] = $color;
        }
        foreach (BidayaLandingDesign::SOCIAL as $network) {
            $rules["{$p}.settings.footer.social.{$network}"] = ['nullable', 'string', 'max:300', new SafeUrl];
        }

        foreach (array_values((array) ($content['sections'] ?? [])) as $i => $section) {
            $s = "{$p}.sections.{$i}";
            $rules["{$s}.id"] = ['required', 'string', 'regex:/^[A-Za-z0-9_-]{6,40}$/'];
            $rules["{$s}.type"] = ['required', Rule::in([...self::SECTION_TYPES, 'ai'])];
            $rules["{$s}.visible"] = ['required', 'boolean'];
            $rules["{$s}.props"] = ['required', 'array'];
            $props = (array) (is_array($section) ? ($section['props'] ?? []) : []);
            $o = "{$s}.props";
            $head = ["{$o}.kicker" => $text(60), "{$o}.title" => $text(80)];
            $iconItems = fn (int $min, int $max, int $length) => [
                "{$o}.items" => ['required', 'array', 'min:'.$min, 'max:'.$max],
                "{$o}.items.*.icon" => $icon,
                "{$o}.items.*.title" => $text(40, true),
                "{$o}.items.*.text" => $text($length),
            ];

            match (is_array($section) ? ($section['type'] ?? null) : null) {
                'ai' => $rules += $this->aiSectionRules($s, $props, self::KEY, $aiSections),
                'hero' => $rules += [
                    "{$o}.layout" => ['required', Rule::in(self::HERO_LAYOUTS)],
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(120, true),
                    "{$o}.highlight" => $text(60),
                    "{$o}.subtitle" => $text(300),
                    "{$o}.image_media_id" => $media,
                    "{$o}.show_price" => ['required', 'boolean'],
                    "{$o}.show_rating" => ['required', 'boolean'],
                    "{$o}.button_label" => $text(40, true),
                    "{$o}.second_label" => $text(40),
                    "{$o}.badges" => ['present', 'array', 'max:3'],
                    "{$o}.badges.*" => $text(30, true),
                ],
                'marquee' => $rules += [
                    "{$o}.items" => ['required', 'array', 'min:1', 'max:10'],
                    "{$o}.items.*" => $text(40, true),
                ],
                'features' => $rules += $head + ["{$o}.subtitle" => $text(200)] + $iconItems(2, 6, 160),
                'details' => $rules += $head + [
                    "{$o}.rows" => ['required', 'array', 'min:1', 'max:4'],
                    "{$o}.rows.*.image_media_id" => $media,
                    "{$o}.rows.*.title" => $text(60, true),
                    "{$o}.rows.*.text" => $text(400),
                    "{$o}.rows.*.points" => ['present', 'array', 'max:5'],
                    "{$o}.rows.*.points.*" => $text(60, true),
                ],
                'specs' => $rules += $head + [
                    "{$o}.image_media_id" => $media,
                    "{$o}.rows" => ['required', 'array', 'min:2', 'max:12'],
                    "{$o}.rows.*.label" => $text(40, true),
                    "{$o}.rows.*.value" => $text(80, true),
                    "{$o}.note" => $text(160),
                ],
                'gallery' => $rules += $head + [
                    "{$o}.image_media_ids" => ['present', 'array', 'max:12'],
                    "{$o}.image_media_ids.*" => ['integer', 'distinct', TenantExists::table('media')],
                ],
                'video' => $rules += [
                    "{$o}.title" => $text(80),
                    "{$o}.subtitle" => $text(200),
                    "{$o}.url" => ['required', 'string', 'max:300', new SafeUrl, 'regex:'.self::VIDEO_HOSTS],
                    "{$o}.cover_media_id" => $media,
                ],
                'bundles' => $rules += $head + [
                    "{$o}.subtitle" => $text(200),
                    // Empty: one card per running offer of the product (and the single piece).
                    "{$o}.cards" => ['present', 'array', 'max:4'],
                    "{$o}.cards.*.offer_id" => ['nullable', 'integer', TenantExists::table('offers')],
                    "{$o}.cards.*.image_media_id" => $media,
                    "{$o}.cards.*.title" => $text(40, true),
                    "{$o}.cards.*.subtitle" => $text(60),
                    "{$o}.cards.*.points" => ['present', 'array', 'max:5'],
                    "{$o}.cards.*.points.*" => $text(60, true),
                    "{$o}.cards.*.ribbon" => $text(24),
                ],
                'stats' => $rules += $head + [
                    "{$o}.items" => ['required', 'array', 'min:2', 'max:4'],
                    "{$o}.items.*.value" => $text(16, true),
                    "{$o}.items.*.label" => $text(40, true),
                ],
                'testimonials' => $rules += $head + [
                    "{$o}.source" => ['required', Rule::in(['auto', 'manual'])],
                    "{$o}.items" => [($props['source'] ?? null) === 'manual' ? 'required' : 'present', 'array', ($props['source'] ?? null) === 'manual' ? 'min:1' : 'min:0', 'max:12'],
                    "{$o}.items.*.name" => $text(60, true),
                    "{$o}.items.*.place" => $text(40),
                    "{$o}.items.*.rating" => ['required', 'integer', 'between:1,5'],
                    "{$o}.items.*.text" => $text(400, true),
                    "{$o}.items.*.image_media_id" => $media,
                    "{$o}.show_score" => ['required', 'boolean'],
                ],
                'countdown' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(80, true),
                    "{$o}.text" => $text(160),
                    "{$o}.ends_at" => ['nullable', 'date'],
                    "{$o}.show_stock" => ['required', 'boolean'],
                ],
                'order_form' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(80, true),
                    "{$o}.subtitle" => $text(200),
                    "{$o}.button_label" => $text(40, true),
                    "{$o}.fields" => ['required', 'array'],
                    "{$o}.offer_picker" => ['required', 'boolean'],
                    "{$o}.show_quantity" => ['required', 'boolean'],
                    "{$o}.points" => ['present', 'array', 'max:5'],
                    "{$o}.points.*" => $text(60, true),
                    "{$o}.image_media_id" => $media,
                ] + self::fieldRules("{$o}.fields"),
                'promises' => $rules += $iconItems(2, 4, 120),
                'faq' => $rules += $head + [
                    "{$o}.items" => ['required', 'array', 'min:1', 'max:12'],
                    "{$o}.items.*.question" => $text(150, true),
                    "{$o}.items.*.answer" => $text(600, true),
                ],
                default => null,
            };
        }

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $d
     * @param  Collection<int, AiSection>  $aiSections
     * @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    private function clean(array $d, Collection $aiSections): array
    {
        $s = $d['settings'];
        $str = fn (mixed $v): ?string => self::str($v);
        $int = fn (mixed $v): ?int => self::int($v);
        $colors = fn (mixed $c): array => array_map(fn ($x) => strtolower((string) $x), array_intersect_key(array_merge(self::DEFAULT_COLORS, (array) $c), self::DEFAULT_COLORS));
        $icons = fn (mixed $items): array => array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'title' => (string) $str($i['title']), 'text' => $str($i['text'] ?? null)], (array) $items));

        $settings = [
            'colors' => $colors($s['colors']),
            'colors_dark' => $colors($s['colors_dark']),
            'appearance' => ['default' => (string) $s['appearance']['default'], 'toggle' => (bool) $s['appearance']['toggle']],
            'font' => (string) $s['font'],
            'font_size' => (string) $s['font_size'],
            'button' => (string) $s['button'],
            'display_font' => (bool) $s['display_font'],
            'logo_media_id' => $int($s['logo_media_id'] ?? null),
            'logo_dark_media_id' => $int($s['logo_dark_media_id'] ?? null),
            'header' => [
                'show' => (bool) $s['header']['show'],
                'announcement' => $str($s['header']['announcement'] ?? null),
                'button_label' => $str($s['header']['button_label'] ?? null),
            ],
            'footer' => [
                'text' => $str($s['footer']['text'] ?? null),
                'phone' => $str($s['footer']['phone'] ?? null),
                'whatsapp' => $str($s['footer']['whatsapp'] ?? null),
                'social' => array_combine(BidayaLandingDesign::SOCIAL, array_map(fn ($n) => $str($s['footer']['social'][$n] ?? null), BidayaLandingDesign::SOCIAL)),
            ],
            'general' => [
                'sticky_order_button' => (bool) $s['general']['sticky_order_button'],
                'whatsapp_button' => (bool) $s['general']['whatsapp_button'],
                'animations' => (bool) $s['general']['animations'],
            ],
        ];

        $sections = [];
        foreach (array_values((array) $d['sections']) as $section) {
            $p = (array) $section['props'];
            $head = ['kicker' => $str($p['kicker'] ?? null), 'title' => $str($p['title'] ?? null)];
            $props = match ($section['type']) {
                'ai' => $this->cleanAiSection($p, $aiSections),
                'hero' => [
                    'layout' => (string) $p['layout'],
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => (string) $str($p['title']),
                    'highlight' => $str($p['highlight'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                    'show_price' => (bool) $p['show_price'],
                    'show_rating' => (bool) $p['show_rating'],
                    'button_label' => (string) $str($p['button_label']),
                    'second_label' => $str($p['second_label'] ?? null),
                    'badges' => self::texts($p['badges'] ?? []),
                ],
                'marquee' => ['items' => self::texts($p['items'])],
                'features' => $head + ['subtitle' => $str($p['subtitle'] ?? null), 'items' => $icons($p['items'])],
                'details' => $head + [
                    'rows' => array_values(array_map(fn (array $r) => [
                        'image_media_id' => $int($r['image_media_id'] ?? null),
                        'title' => (string) $str($r['title']),
                        'text' => $str($r['text'] ?? null),
                        'points' => self::texts($r['points'] ?? []),
                    ], (array) $p['rows'])),
                ],
                'specs' => $head + [
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                    'rows' => array_values(array_map(fn (array $r) => ['label' => (string) $str($r['label']), 'value' => (string) $str($r['value'])], (array) $p['rows'])),
                    'note' => $str($p['note'] ?? null),
                ],
                'gallery' => $head + ['image_media_ids' => array_values(array_map('intval', (array) ($p['image_media_ids'] ?? [])))],
                'video' => [
                    'title' => $str($p['title'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'url' => trim((string) $p['url']),
                    'cover_media_id' => $int($p['cover_media_id'] ?? null),
                ],
                'bundles' => $head + [
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'cards' => array_values(array_map(fn (array $c) => [
                        'offer_id' => $int($c['offer_id'] ?? null),
                        'image_media_id' => $int($c['image_media_id'] ?? null),
                        'title' => (string) $str($c['title']),
                        'subtitle' => $str($c['subtitle'] ?? null),
                        'points' => self::texts($c['points'] ?? []),
                        'ribbon' => $str($c['ribbon'] ?? null),
                    ], (array) ($p['cards'] ?? []))),
                ],
                'stats' => $head + ['items' => array_values(array_map(fn (array $i) => ['value' => (string) $str($i['value']), 'label' => (string) $str($i['label'])], (array) $p['items']))],
                'testimonials' => $head + [
                    'source' => (string) $p['source'],
                    'items' => array_values(array_map(fn (array $i) => ['name' => (string) $str($i['name']), 'place' => $str($i['place'] ?? null), 'rating' => (int) $i['rating'], 'text' => (string) $str($i['text']), 'image_media_id' => $int($i['image_media_id'] ?? null)], (array) ($p['items'] ?? []))),
                    'show_score' => (bool) $p['show_score'],
                ],
                'countdown' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => (string) $str($p['title']),
                    'text' => $str($p['text'] ?? null),
                    'ends_at' => self::date($p['ends_at'] ?? null),
                    'show_stock' => (bool) $p['show_stock'],
                ],
                'order_form' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => (string) $str($p['title']),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'button_label' => (string) $str($p['button_label']),
                    'fields' => self::fields((array) $p['fields']),
                    'offer_picker' => (bool) $p['offer_picker'],
                    'show_quantity' => (bool) $p['show_quantity'],
                    'points' => self::texts($p['points'] ?? []),
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                ],
                'promises' => ['items' => $icons($p['items'])],
                'faq' => $head + ['items' => array_values(array_map(fn (array $i) => ['question' => (string) $str($i['question']), 'answer' => (string) $str($i['answer'])], (array) $p['items']))],
            };
            $sections[] = ['id' => (string) $section['id'], 'type' => (string) $section['type'], 'visible' => (bool) $section['visible'], 'props' => $props];
        }

        return ['version' => 1, 'settings' => $settings, 'sections' => $sections];
    }
}
