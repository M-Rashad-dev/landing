<?php

declare(strict_types=1);

namespace App\Themes\Landing;

use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * «شابع», the paid food landing theme: one product (a meal, a box, a tray) sold through one
 * order form, with food-shop sections (menu of the box, steps, packs tied to the product's
 * offers, comparison, countdown, guarantee…). Same contract as «بداية» (BidayaLandingDesign): unknown
 * keys are dropped, texts trimmed and stripped of tags, images are *_media_id(s) keys. Its
 * settings are a superset of «بداية»'s, so the shared page pieces read them the same way.
 */
final class ShabeLandingDesign implements LandingThemeDesign
{
    use LandingContent;

    public const KEY = 'shabe_landing';

    public const SECTION_TYPES = [
        'hero', 'marquee', 'menu', 'why', 'steps', 'bundles', 'gallery', 'video',
        'compare', 'testimonials', 'urgency', 'order_form', 'guarantee', 'faq',
    ];

    public const MAX_SECTIONS = 20;

    public const ICONS = [
        ...BidayaLandingDesign::ICONS,
        'flame', 'chef', 'leaf', 'utensils', 'meat', 'timer', 'thermo', 'bike', 'soup', 'sparkle',
    ];

    public const DEFAULT_COLORS = ['primary' => '#e4572e', 'secondary' => '#f2b33d', 'background' => '#fffaf2', 'text' => '#1b120c', 'dark' => '#17110d'];

    private const VIDEO_HOSTS = '#^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/#i';

    /**
     * A new page: the food sections with starter copy (the product name on top) and the form.
     *
     * @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    public static function defaults(?string $productName = null): array
    {
        $t = fn (string $key) => __('themes/landing/shabe.'.$key);

        return [
            'version' => 1,
            'settings' => [
                'colors' => self::DEFAULT_COLORS,
                'font' => 'cairo',
                'font_size' => 'medium',
                'button' => 'rounded',
                'display_font' => true,
                'logo_media_id' => null,
                'header' => ['show' => true, 'announcement' => (string) $t('announcement'), 'countdown_ends_at' => null, 'phone' => null, 'button_label' => (string) $t('order_now')],
                'footer' => ['text' => null, 'phone' => null, 'whatsapp' => null, 'social' => array_fill_keys(BidayaLandingDesign::SOCIAL, null)],
                'general' => ['sticky_order_button' => true, 'whatsapp_button' => false],
            ],
            'sections' => [
                self::section('hero', [
                    'kicker' => (string) $t('hero.kicker'),
                    'title' => $productName ?? (string) $t('hero.title'),
                    'highlight' => null,
                    'subtitle' => (string) $t('hero.subtitle'),
                    'image_media_id' => null,
                    'stickers' => (array) $t('hero.stickers'),
                    'badge' => (string) $t('hero.badge'),
                    'show_price' => true,
                    'show_rating' => true,
                    'button_label' => (string) $t('order_now'),
                    'second_label' => (string) $t('hero.second'),
                    'trust' => (array) $t('hero.trust'),
                ]),
                self::section('marquee', ['items' => (array) $t('marquee')]),
                self::section('menu', ['kicker' => null, 'title' => (string) $t('menu.title'), 'subtitle' => (string) $t('menu.subtitle'), 'items' => array_map(fn (array $i) => ['image_media_id' => null] + $i, (array) $t('menu.items')), 'extras' => (array) $t('menu.extras')]),
                self::section('why', ['kicker' => (string) $t('why.kicker'), 'title' => (string) $t('why.title'), 'subtitle' => null, 'image_media_id' => null, 'quote' => null, 'items' => (array) $t('why.items')]),
                self::section('steps', ['kicker' => null, 'title' => (string) $t('steps.title'), 'items' => (array) $t('steps.items')]),
                self::section('bundles', ['kicker' => null, 'title' => (string) $t('bundles.title'), 'subtitle' => null, 'cards' => []]),
                self::section('gallery', ['title' => (string) $t('gallery_title'), 'image_media_ids' => []]),
                self::section('testimonials', ['kicker' => null, 'title' => (string) $t('testimonials_title'), 'source' => 'auto', 'items' => [], 'show_score' => true]),
                self::section('order_form', self::orderFormDefaults()),
                self::section('guarantee', ['icon' => 'shield', 'title' => (string) $t('guarantee.title'), 'text' => (string) $t('guarantee.text')]),
                self::section('faq', ['title' => (string) $t('faq_title'), 'items' => (array) $t('faq')]),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function orderFormDefaults(): array
    {
        return [
            'kicker' => (string) __('themes/landing/shabe.form.kicker'),
            'title' => (string) __('themes/landing/shabe.form.title'),
            'subtitle' => (string) __('themes/landing/shabe.form.subtitle'),
            'button_label' => (string) __('themes/landing/shabe.form.button'),
            'fields' => self::fields([]),
            'offer_picker' => true,
            'show_quantity' => true,
            'points' => (array) __('themes/landing/shabe.form.points'),
            'image_media_id' => null,
        ];
    }

    /**
     * Validates a page content sent by the Builder and returns it cleaned (only known keys).
     *
     * @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>}
     *
     * @throws ValidationException keys like content.sections.2.props.title
     */
    public function validate(mixed $content, string $prefix = 'content'): array
    {
        return self::checked($content, $prefix, fn (array $c, string $p) => $this->rules($c, $p), (array) __('design.attributes') + (array) __('themes/landing/bidaya.attributes') + (array) __('themes/landing/shabe.attributes'), fn (array $d) => $this->clean($d));
    }

    /** @param array<string, mixed> $content @return array<string, mixed> */
    private function rules(array $content, string $p): array
    {
        $text = fn (int $max, bool $required = false) => [$required ? 'required' : 'nullable', 'string', 'max:'.$max];
        $color = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $media = ['nullable', 'integer', TenantExists::table('media')];
        $icon = ['required', Rule::in(self::ICONS)];

        $rules = [
            $p => ['required', 'array'],
            "{$p}.settings" => ['required', 'array'],
            "{$p}.settings.font" => ['required', Rule::in((array) config('landing.fonts'))],
            "{$p}.settings.font_size" => ['required', Rule::in(BidayaLandingDesign::FONT_SIZES)],
            "{$p}.settings.button" => ['required', Rule::in(BidayaLandingDesign::BUTTONS)],
            "{$p}.settings.display_font" => ['required', 'boolean'],
            "{$p}.settings.logo_media_id" => $media,
            "{$p}.settings.header.show" => ['required', 'boolean'],
            "{$p}.settings.header.announcement" => $text(200),
            "{$p}.settings.header.countdown_ends_at" => ['nullable', 'date'],
            "{$p}.settings.header.phone" => $text(30),
            "{$p}.settings.header.button_label" => $text(40),
            "{$p}.settings.footer.text" => $text(300),
            "{$p}.settings.footer.phone" => $text(30),
            "{$p}.settings.footer.whatsapp" => $text(30),
            "{$p}.settings.general.sticky_order_button" => ['required', 'boolean'],
            "{$p}.settings.general.whatsapp_button" => ['required', 'boolean'],
            "{$p}.sections" => ['required', 'array', 'min:1', 'max:'.self::MAX_SECTIONS],
        ];
        foreach (array_keys(self::DEFAULT_COLORS) as $key) {
            $rules["{$p}.settings.colors.{$key}"] = $color;
        }
        foreach (BidayaLandingDesign::SOCIAL as $network) {
            $rules["{$p}.settings.footer.social.{$network}"] = ['nullable', 'string', 'max:300', new SafeUrl];
        }

        foreach (array_values((array) ($content['sections'] ?? [])) as $i => $section) {
            $s = "{$p}.sections.{$i}";
            $rules["{$s}.id"] = ['required', 'string', 'regex:/^[A-Za-z0-9_-]{6,40}$/'];
            $rules["{$s}.type"] = ['required', Rule::in(self::SECTION_TYPES)];
            $rules["{$s}.visible"] = ['required', 'boolean'];
            $rules["{$s}.props"] = ['required', 'array'];
            $props = (array) (is_array($section) ? ($section['props'] ?? []) : []);
            $o = "{$s}.props";

            match (is_array($section) ? ($section['type'] ?? null) : null) {
                'hero' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(120, true),
                    "{$o}.highlight" => $text(60),
                    "{$o}.subtitle" => $text(300),
                    "{$o}.image_media_id" => $media,
                    "{$o}.stickers" => ['present', 'array', 'max:2'],
                    "{$o}.stickers.*" => $text(30, true),
                    "{$o}.badge" => $text(24),
                    "{$o}.show_price" => ['required', 'boolean'],
                    "{$o}.show_rating" => ['required', 'boolean'],
                    "{$o}.button_label" => $text(40, true),
                    "{$o}.second_label" => $text(40),
                    "{$o}.trust" => ['present', 'array', 'max:3'],
                    "{$o}.trust.*.icon" => $icon,
                    "{$o}.trust.*.text" => $text(40, true),
                ],
                'marquee' => $rules += [
                    "{$o}.items" => ['required', 'array', 'min:1', 'max:10'],
                    "{$o}.items.*" => $text(40, true),
                ],
                'menu' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(80),
                    "{$o}.subtitle" => $text(200),
                    "{$o}.items" => ['required', 'array', 'min:1', 'max:8'],
                    "{$o}.items.*.image_media_id" => $media,
                    "{$o}.items.*.title" => $text(40, true),
                    "{$o}.items.*.text" => $text(120),
                    "{$o}.items.*.tag" => $text(24),
                    "{$o}.extras" => ['present', 'array', 'max:12'],
                    "{$o}.extras.*" => $text(40, true),
                ],
                'why' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(80),
                    "{$o}.subtitle" => $text(200),
                    "{$o}.image_media_id" => $media,
                    "{$o}.quote" => $text(160),
                    "{$o}.items" => ['required', 'array', 'min:2', 'max:6'],
                    "{$o}.items.*.icon" => $icon,
                    "{$o}.items.*.title" => $text(40, true),
                    "{$o}.items.*.text" => $text(120),
                ],
                'steps' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(80),
                    "{$o}.items" => ['required', 'array', 'min:2', 'max:4'],
                    "{$o}.items.*.icon" => $icon,
                    "{$o}.items.*.title" => $text(40, true),
                    "{$o}.items.*.text" => $text(160),
                ],
                'bundles' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(80),
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
                'gallery' => $rules += [
                    "{$o}.title" => $text(80),
                    "{$o}.image_media_ids" => ['present', 'array', 'max:12'],
                    "{$o}.image_media_ids.*" => ['integer', 'distinct', TenantExists::table('media')],
                ],
                'video' => $rules += [
                    "{$o}.title" => $text(80),
                    "{$o}.subtitle" => $text(200),
                    "{$o}.url" => ['required', 'string', 'max:300', new SafeUrl, 'regex:'.self::VIDEO_HOSTS],
                    "{$o}.cover_media_id" => $media,
                    "{$o}.caption" => $text(60),
                ],
                'compare' => $rules += [
                    "{$o}.title" => $text(80),
                    "{$o}.us" => $text(30, true),
                    "{$o}.them" => $text(30, true),
                    "{$o}.rows" => ['required', 'array', 'min:2', 'max:8'],
                    "{$o}.rows.*.label" => $text(50, true),
                    "{$o}.rows.*.us" => $text(50, true),
                    "{$o}.rows.*.them" => $text(50, true),
                ],
                'testimonials' => $rules += [
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(80),
                    "{$o}.source" => ['required', Rule::in(['auto', 'manual'])],
                    "{$o}.items" => [($props['source'] ?? null) === 'manual' ? 'required' : 'present', 'array', ($props['source'] ?? null) === 'manual' ? 'min:1' : 'min:0', 'max:12'],
                    "{$o}.items.*.name" => $text(60, true),
                    "{$o}.items.*.place" => $text(40),
                    "{$o}.items.*.rating" => ['required', 'integer', 'between:1,5'],
                    "{$o}.items.*.text" => $text(400, true),
                    "{$o}.items.*.image_media_id" => $media,
                    "{$o}.show_score" => ['required', 'boolean'],
                ],
                'urgency' => $rules += [
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
                'guarantee' => $rules += [
                    "{$o}.icon" => $icon,
                    "{$o}.title" => $text(80, true),
                    "{$o}.text" => $text(300),
                ],
                'faq' => $rules += [
                    "{$o}.title" => $text(80),
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
     * @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    private function clean(array $d): array
    {
        $s = $d['settings'];
        $str = fn (mixed $v): ?string => is_string($v) && trim(strip_tags($v)) !== '' ? trim(strip_tags($v)) : null;
        $int = fn (mixed $v): ?int => $v === null || $v === '' ? null : (int) $v;
        $date = fn (mixed $v): ?string => is_string($v) && $v !== '' ? Carbon::parse($v)->utc()->toIso8601ZuluString() : null;
        $list = fn (mixed $v): array => array_values(array_filter(array_map($str, (array) $v), fn ($x) => $x !== null));
        $icons = fn (mixed $items): array => array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'title' => (string) $str($i['title']), 'text' => $str($i['text'] ?? null)], (array) $items));

        $settings = [
            'colors' => array_map(fn ($c) => strtolower((string) $c), array_intersect_key((array) $s['colors'], self::DEFAULT_COLORS)),
            'font' => (string) $s['font'],
            'font_size' => (string) $s['font_size'],
            'button' => (string) $s['button'],
            'display_font' => (bool) $s['display_font'],
            'logo_media_id' => $int($s['logo_media_id'] ?? null),
            'header' => [
                'show' => (bool) $s['header']['show'],
                'announcement' => $str($s['header']['announcement'] ?? null),
                'countdown_ends_at' => $date($s['header']['countdown_ends_at'] ?? null),
                'phone' => $str($s['header']['phone'] ?? null),
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
            ],
        ];

        $sections = [];
        foreach (array_values((array) $d['sections']) as $section) {
            $p = (array) $section['props'];
            $props = match ($section['type']) {
                'hero' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => (string) $str($p['title']),
                    'highlight' => $str($p['highlight'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                    'stickers' => $list($p['stickers'] ?? []),
                    'badge' => $str($p['badge'] ?? null),
                    'show_price' => (bool) $p['show_price'],
                    'show_rating' => (bool) $p['show_rating'],
                    'button_label' => (string) $str($p['button_label']),
                    'second_label' => $str($p['second_label'] ?? null),
                    'trust' => array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'text' => (string) $str($i['text'])], (array) ($p['trust'] ?? []))),
                ],
                'marquee' => ['items' => $list($p['items'])],
                'menu' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => $str($p['title'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'items' => array_values(array_map(fn (array $i) => ['image_media_id' => $int($i['image_media_id'] ?? null), 'title' => (string) $str($i['title']), 'text' => $str($i['text'] ?? null), 'tag' => $str($i['tag'] ?? null)], (array) $p['items'])),
                    'extras' => $list($p['extras'] ?? []),
                ],
                'why' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => $str($p['title'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                    'quote' => $str($p['quote'] ?? null),
                    'items' => $icons($p['items']),
                ],
                'steps' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => $str($p['title'] ?? null),
                    'items' => $icons($p['items']),
                ],
                'bundles' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => $str($p['title'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'cards' => array_values(array_map(fn (array $c) => [
                        'offer_id' => $int($c['offer_id'] ?? null),
                        'image_media_id' => $int($c['image_media_id'] ?? null),
                        'title' => (string) $str($c['title']),
                        'subtitle' => $str($c['subtitle'] ?? null),
                        'points' => $list($c['points'] ?? []),
                        'ribbon' => $str($c['ribbon'] ?? null),
                    ], (array) ($p['cards'] ?? []))),
                ],
                'gallery' => [
                    'title' => $str($p['title'] ?? null),
                    'image_media_ids' => array_values(array_map('intval', (array) ($p['image_media_ids'] ?? []))),
                ],
                'video' => [
                    'title' => $str($p['title'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'url' => trim((string) $p['url']),
                    'cover_media_id' => $int($p['cover_media_id'] ?? null),
                    'caption' => $str($p['caption'] ?? null),
                ],
                'compare' => [
                    'title' => $str($p['title'] ?? null),
                    'us' => (string) $str($p['us']),
                    'them' => (string) $str($p['them']),
                    'rows' => array_values(array_map(fn (array $r) => ['label' => (string) $str($r['label']), 'us' => (string) $str($r['us']), 'them' => (string) $str($r['them'])], (array) $p['rows'])),
                ],
                'testimonials' => [
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => $str($p['title'] ?? null),
                    'source' => (string) $p['source'],
                    'items' => array_values(array_map(fn (array $i) => ['name' => (string) $str($i['name']), 'place' => $str($i['place'] ?? null), 'rating' => (int) $i['rating'], 'text' => (string) $str($i['text']), 'image_media_id' => $int($i['image_media_id'] ?? null)], (array) ($p['items'] ?? []))),
                    'show_score' => (bool) $p['show_score'],
                ],
                'urgency' => [
                    'title' => (string) $str($p['title']),
                    'text' => $str($p['text'] ?? null),
                    'ends_at' => $date($p['ends_at'] ?? null),
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
                    'points' => $list($p['points'] ?? []),
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                ],
                'guarantee' => [
                    'icon' => (string) $p['icon'],
                    'title' => (string) $str($p['title']),
                    'text' => $str($p['text'] ?? null),
                ],
                'faq' => [
                    'title' => $str($p['title'] ?? null),
                    'items' => array_values(array_map(fn (array $i) => ['question' => (string) $str($i['question']), 'answer' => (string) $str($i['answer'])], (array) $p['items'])),
                ],
            };
            $sections[] = ['id' => (string) $section['id'], 'type' => (string) $section['type'], 'visible' => (bool) $section['visible'], 'props' => $props];
        }

        return ['version' => 1, 'settings' => $settings, 'sections' => $sections];
    }
}
