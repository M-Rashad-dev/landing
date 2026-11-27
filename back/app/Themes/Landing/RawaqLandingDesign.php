<?php

declare(strict_types=1);

namespace App\Themes\Landing;

use App\Models\AiSection;
use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * «رواق», the beauty and care landing theme: one skin, hair or make-up product (a serum, a cream, an
 * oil, a set) sold through one order form, in «رواق»'s soft pastel look. Its own sections show what a
 * beauty buyer checks before ordering: what it helps with, before / after, what's inside, how to use
 * it, who it suits. Same contract as the other landing themes (LandingContent): unknown keys
 * dropped, texts trimmed, exactly one order form.
 */
final class RawaqLandingDesign implements LandingThemeDesign
{
    use LandingContent;

    public const KEY = 'rawaq_landing';

    public const SECTION_TYPES = [
        'hero', 'trust', 'benefits', 'before_after', 'ingredients', 'how_to', 'suits', 'bundles',
        'stats', 'gallery', 'video', 'testimonials', 'countdown', 'order_form', 'promises', 'faq',
    ];

    public const MAX_SECTIONS = 20;

    public const ICONS = [
        ...BidayaLandingDesign::ICONS,
        'droplet', 'sparkle', 'leaf', 'sun', 'moon', 'flask', 'smile', 'feather', 'award', 'gem', 'hand', 'flower',
    ];

    public const DEFAULT_COLORS = ['primary' => '#b9507a', 'secondary' => '#3d9a6f', 'background' => '#fbf7f3', 'text' => '#2b2226', 'dark' => '#2b2226'];

    private const HEX = 'regex:/^#[0-9a-fA-F]{6}$/';

    private const VIDEO_HOSTS = '#^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/#i';

    /** @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public static function defaults(?string $productName = null): array
    {
        $t = fn (string $key) => __('themes/landing/rawaq.'.$key);

        return [
            'version' => 1,
            'settings' => [
                'colors' => self::DEFAULT_COLORS,
                'font' => 'cairo',
                'font_size' => 'medium',
                'button' => 'pill',
                'display_font' => true,
                'logo_media_id' => null,
                'header' => ['show' => true, 'announcement' => (string) $t('announcement'), 'button_label' => (string) $t('order_now')],
                'footer' => ['text' => null, 'phone' => null, 'whatsapp' => null, 'social' => array_fill_keys(BidayaLandingDesign::SOCIAL, null)],
                'general' => ['sticky_order_button' => true, 'whatsapp_button' => false, 'animations' => true],
            ],
            'sections' => [
                self::section('hero', [
                    'kicker' => (string) $t('hero.kicker'),
                    'title' => $productName ?? (string) $t('hero.title'),
                    'highlight' => null,
                    'subtitle' => (string) $t('hero.subtitle'),
                    'image_media_id' => null,
                    'badge' => (string) $t('hero.badge'),
                    'show_price' => true,
                    'show_rating' => true,
                    'button_label' => (string) $t('order_now'),
                    'second_label' => (string) $t('hero.second'),
                    'chips' => (array) $t('hero.chips'),
                ]),
                self::section('trust', ['items' => (array) $t('trust')]),
                self::section('benefits', ['kicker' => (string) $t('benefits.kicker'), 'title' => (string) $t('benefits.title'), 'items' => (array) $t('benefits.items')]),
                self::section('ingredients', ['kicker' => (string) $t('ingredients.kicker'), 'title' => (string) $t('ingredients.title'), 'subtitle' => null, 'items' => (array) $t('ingredients.items')]),
                self::section('how_to', ['kicker' => (string) $t('how_to.kicker'), 'title' => (string) $t('how_to.title'), 'image_media_id' => null, 'steps' => (array) $t('how_to.steps'), 'note' => (string) $t('how_to.note')]),
                self::section('suits', ['title' => (string) $t('suits.title'), 'items' => (array) $t('suits.items'), 'note' => null]),
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
            'kicker' => (string) __('themes/landing/rawaq.form.kicker'),
            'title' => (string) __('themes/landing/rawaq.form.title'),
            'subtitle' => (string) __('themes/landing/rawaq.form.subtitle'),
            'button_label' => (string) __('themes/landing/rawaq.form.button'),
            'fields' => self::fields([]),
            'offer_picker' => true,
            'show_quantity' => true,
            'points' => (array) __('themes/landing/rawaq.form.points'),
            'image_media_id' => null,
        ];
    }

    public function validate(mixed $content, string $prefix = 'content'): array
    {
        $names = (array) __('design.attributes') + (array) __('themes/landing/bidaya.attributes') + (array) __('themes/landing/shabe.attributes') + (array) __('themes/landing/sufi.attributes') + (array) __('themes/landing/rawaq.attributes');
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
        $media = ['nullable', 'integer', TenantExists::table('media')];
        $mediaRequired = ['required', 'integer', TenantExists::table('media')];
        $icon = ['required', Rule::in(self::ICONS)];
        $color = ['nullable', 'string', self::HEX];

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
            $rules["{$p}.settings.colors.{$key}"] = ['required', 'string', self::HEX];
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
                    "{$o}.kicker" => $text(60),
                    "{$o}.title" => $text(120, true),
                    "{$o}.highlight" => $text(60),
                    "{$o}.subtitle" => $text(300),
                    "{$o}.image_media_id" => $media,
                    "{$o}.badge" => $text(20),
                    "{$o}.show_price" => ['required', 'boolean'],
                    "{$o}.show_rating" => ['required', 'boolean'],
                    "{$o}.button_label" => $text(40, true),
                    "{$o}.second_label" => $text(40),
                    "{$o}.chips" => ['present', 'array', 'max:4'],
                    "{$o}.chips.*" => $text(30, true),
                ],
                'trust' => $rules += $iconItems(2, 4, 80),
                'benefits' => $rules += $head + [
                    "{$o}.items" => ['required', 'array', 'min:2', 'max:6'],
                    "{$o}.items.*.icon" => $icon,
                    "{$o}.items.*.title" => $text(40, true),
                    "{$o}.items.*.text" => $text(160),
                    "{$o}.items.*.color" => $color,
                ],
                'before_after' => $rules += $head + [
                    "{$o}.text" => $text(300),
                    "{$o}.before_media_id" => $mediaRequired,
                    "{$o}.after_media_id" => $mediaRequired,
                    "{$o}.before_label" => $text(20, true),
                    "{$o}.after_label" => $text(20, true),
                    "{$o}.facts" => ['present', 'array', 'max:3'],
                    "{$o}.facts.*.value" => $text(12, true),
                    "{$o}.facts.*.label" => $text(40, true),
                ],
                'ingredients' => $rules += $head + [
                    "{$o}.subtitle" => $text(200),
                    "{$o}.items" => ['required', 'array', 'min:2', 'max:8'],
                    "{$o}.items.*.symbol" => $text(4, true),
                    "{$o}.items.*.name" => $text(40, true),
                    "{$o}.items.*.text" => $text(120),
                    "{$o}.items.*.color" => $color,
                ],
                'how_to' => $rules += $head + [
                    "{$o}.image_media_id" => $media,
                    "{$o}.steps" => ['required', 'array', 'min:2', 'max:5'],
                    "{$o}.steps.*.title" => $text(50, true),
                    "{$o}.steps.*.text" => $text(200),
                    "{$o}.steps.*.time" => $text(20),
                    "{$o}.note" => $text(200),
                ],
                'suits' => $rules += [
                    "{$o}.title" => $text(80, true),
                    "{$o}.items" => ['required', 'array', 'min:1', 'max:8'],
                    "{$o}.items.*" => $text(30, true),
                    "{$o}.note" => $text(200),
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
        $hex = fn (mixed $v): ?string => is_string($v) && $v !== '' ? strtolower($v) : null;
        $icons = fn (mixed $items): array => array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'title' => (string) $str($i['title']), 'text' => $str($i['text'] ?? null)], (array) $items));

        $settings = [
            'colors' => array_map(fn ($x) => strtolower((string) $x), array_intersect_key(array_merge(self::DEFAULT_COLORS, (array) $s['colors']), self::DEFAULT_COLORS)),
            'font' => (string) $s['font'],
            'font_size' => (string) $s['font_size'],
            'button' => (string) $s['button'],
            'display_font' => (bool) $s['display_font'],
            'logo_media_id' => $int($s['logo_media_id'] ?? null),
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
                    'kicker' => $str($p['kicker'] ?? null),
                    'title' => (string) $str($p['title']),
                    'highlight' => $str($p['highlight'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                    'badge' => $str($p['badge'] ?? null),
                    'show_price' => (bool) $p['show_price'],
                    'show_rating' => (bool) $p['show_rating'],
                    'button_label' => (string) $str($p['button_label']),
                    'second_label' => $str($p['second_label'] ?? null),
                    'chips' => self::texts($p['chips'] ?? []),
                ],
                'trust' => ['items' => $icons($p['items'])],
                'benefits' => $head + [
                    'items' => array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'title' => (string) $str($i['title']), 'text' => $str($i['text'] ?? null), 'color' => $hex($i['color'] ?? null)], (array) $p['items'])),
                ],
                'before_after' => $head + [
                    'text' => $str($p['text'] ?? null),
                    'before_media_id' => (int) $p['before_media_id'],
                    'after_media_id' => (int) $p['after_media_id'],
                    'before_label' => (string) $str($p['before_label']),
                    'after_label' => (string) $str($p['after_label']),
                    'facts' => array_values(array_map(fn (array $f) => ['value' => (string) $str($f['value']), 'label' => (string) $str($f['label'])], (array) ($p['facts'] ?? []))),
                ],
                'ingredients' => $head + [
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'items' => array_values(array_map(fn (array $i) => ['symbol' => (string) $str($i['symbol']), 'name' => (string) $str($i['name']), 'text' => $str($i['text'] ?? null), 'color' => $hex($i['color'] ?? null)], (array) $p['items'])),
                ],
                'how_to' => $head + [
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                    'steps' => array_values(array_map(fn (array $st) => ['title' => (string) $str($st['title']), 'text' => $str($st['text'] ?? null), 'time' => $str($st['time'] ?? null)], (array) $p['steps'])),
                    'note' => $str($p['note'] ?? null),
                ],
                'suits' => ['title' => (string) $str($p['title']), 'items' => self::texts($p['items']), 'note' => $str($p['note'] ?? null)],
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
                'gallery' => $head + ['image_media_ids' => array_values(array_map('intval', (array) ($p['image_media_ids'] ?? [])))],
                'video' => [
                    'title' => $str($p['title'] ?? null),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'url' => trim((string) $p['url']),
                    'cover_media_id' => $int($p['cover_media_id'] ?? null),
                ],
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
