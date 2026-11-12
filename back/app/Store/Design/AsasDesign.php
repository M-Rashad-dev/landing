<?php

declare(strict_types=1);

namespace App\Store\Design;

use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * «أساس», the free store theme: what its design may hold (home sections and theme settings),
 * the starter design, and the validation + clean-up of every save. Unknown keys are dropped;
 * texts are trimmed and stripped of tags.
 */
final class AsasDesign
{
    public const KEY = 'asas';

    public const SECTION_TYPES = ['banner', 'products', 'features', 'testimonials'];

    public const MAX_SECTIONS = 20;

    public const FONT_SIZES = ['small', 'medium', 'large'];

    public const PRODUCT_SOURCES = ['latest', 'offers', 'category'];

    public const PRODUCT_LIMITS = [4, 8, 12, 16, 24, 32];

    public const COLUMNS = [2, 3, 4, 5];

    public const PER_PAGE = [12, 16, 24, 32, 48];

    public const ICONS = ['truck', 'cash', 'return', 'shield', 'support', 'gift', 'star', 'clock', 'tag', 'heart', 'package', 'phone'];

    public const LINK_TYPES = ['none', 'all_products', 'offers', 'category', 'product', 'url'];

    public const SOCIAL = ['facebook', 'instagram', 'tiktok', 'x', 'youtube', 'snapchat'];

    /** «نعناع», the platform colors (owner decision: the default of «أساس»). */
    public const DEFAULT_COLORS = ['primary' => '#0b875b', 'secondary' => '#ffc83d', 'background' => '#ffffff', 'text' => '#13261d'];

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    public static function defaults(?int $logoMediaId = null): array
    {
        return [
            'settings' => [
                'colors' => self::DEFAULT_COLORS,
                'font' => 'cairo',
                'font_size' => 'medium',
                'logo_media_id' => $logoMediaId,
                'favicon_media_id' => null,
                'header' => ['sticky' => true, 'search' => true, 'announcement' => null],
                'footer' => [
                    'about' => null,
                    'show_pages' => true,
                    'phone' => null,
                    'whatsapp' => null,
                    'email' => null,
                    'address' => null,
                    'social' => array_fill_keys(self::SOCIAL, null),
                ],
                'general' => ['whatsapp_button' => true, 'show_out_of_stock' => true, 'products_per_page' => 24],
            ],
            'sections' => [
                self::section('banner', ['slides' => [], 'autoplay' => true]),
                self::section('products', [
                    'title' => __('design.products_title'),
                    'description' => __('design.products_description'),
                    'source' => 'latest',
                    'category_id' => null,
                    'limit' => 8,
                    'layout' => 'grid',
                    'columns' => 4,
                    'show_view_all' => true,
                ]),
                self::section('features', ['title' => null, 'items' => (array) __('design.features')]),
                self::section('testimonials', ['title' => __('design.testimonials_title'), 'source' => 'auto', 'items' => []]),
            ],
        ];
    }

    /** @param array<string, mixed> $props @return array<string, mixed> */
    private static function section(string $type, array $props): array
    {
        return ['id' => substr(bin2hex(random_bytes(6)), 0, 12), 'type' => $type, 'visible' => true, 'props' => $props];
    }

    /**
     * Validates a design sent by the Builder and returns it cleaned (only known keys).
     *
     * @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>}
     *
     * @throws ValidationException keys like draft.sections.2.props.title
     */
    public function validate(mixed $design, string $prefix = 'draft'): array
    {
        $data = [$prefix => is_array($design) ? $design : []];
        $validator = Validator::make($data, $this->rules($data[$prefix], $prefix), [], $this->attributes($data[$prefix], $prefix));
        $validator->after(function ($v) use ($data, $prefix): void {
            // Each section id once (the Builder and the data map are keyed by it).
            $seen = [];
            foreach (array_values((array) ($data[$prefix]['sections'] ?? [])) as $i => $section) {
                $id = is_array($section) ? ($section['id'] ?? null) : null;
                if (is_string($id) && isset($seen[$id])) {
                    $v->errors()->add("{$prefix}.sections.{$i}.id", __('validation.distinct', ['attribute' => 'id']));
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
        $text = fn (int $max, bool $required = false) => [$required ? 'required' : 'nullable', 'string', 'max:'.$max];
        $color = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $media = ['nullable', 'integer', TenantExists::table('media')];

        $rules = [
            $p => ['required', 'array'],
            "{$p}.settings" => ['required', 'array'],
            "{$p}.settings.colors.primary" => $color,
            "{$p}.settings.colors.secondary" => $color,
            "{$p}.settings.colors.background" => $color,
            "{$p}.settings.colors.text" => $color,
            "{$p}.settings.font" => ['required', Rule::in((array) config('landing.fonts'))],
            "{$p}.settings.font_size" => ['required', Rule::in(self::FONT_SIZES)],
            "{$p}.settings.logo_media_id" => $media,
            "{$p}.settings.favicon_media_id" => $media,
            "{$p}.settings.header.sticky" => ['required', 'boolean'],
            "{$p}.settings.header.search" => ['required', 'boolean'],
            "{$p}.settings.header.announcement" => $text(200),
            "{$p}.settings.footer.about" => $text(500),
            "{$p}.settings.footer.show_pages" => ['required', 'boolean'],
            "{$p}.settings.footer.phone" => $text(30),
            "{$p}.settings.footer.whatsapp" => $text(30),
            "{$p}.settings.footer.email" => ['nullable', 'string', 'email:filter', 'max:191'],
            "{$p}.settings.footer.address" => $text(200),
            "{$p}.settings.general.whatsapp_button" => ['required', 'boolean'],
            "{$p}.settings.general.show_out_of_stock" => ['required', 'boolean'],
            "{$p}.settings.general.products_per_page" => ['required', 'integer', Rule::in(self::PER_PAGE)],
            "{$p}.sections" => ['present', 'array', 'max:'.self::MAX_SECTIONS],
        ];
        foreach (self::SOCIAL as $network) {
            $rules["{$p}.settings.footer.social.{$network}"] = ['nullable', 'string', 'max:300', new SafeUrl];
        }

        foreach (array_values((array) ($design['sections'] ?? [])) as $i => $section) {
            $s = "{$p}.sections.{$i}";
            $rules["{$s}.id"] = ['required', 'string', 'regex:/^[A-Za-z0-9_-]{6,40}$/'];
            $rules["{$s}.type"] = ['required', Rule::in(self::SECTION_TYPES)];
            $rules["{$s}.visible"] = ['required', 'boolean'];
            $rules["{$s}.props"] = ['required', 'array'];
            $props = (array) ($section['props'] ?? []);

            match (is_array($section) ? ($section['type'] ?? null) : null) {
                'banner' => $rules += $this->bannerRules($s, $props, $text),
                'products' => $rules += [
                    "{$s}.props.title" => $text(80, true),
                    "{$s}.props.description" => $text(200),
                    "{$s}.props.source" => ['required', Rule::in(self::PRODUCT_SOURCES)],
                    "{$s}.props.category_id" => [($props['source'] ?? null) === 'category' ? 'required' : 'nullable', 'integer', TenantExists::table('categories')],
                    "{$s}.props.limit" => ['required', 'integer', Rule::in(self::PRODUCT_LIMITS)],
                    "{$s}.props.layout" => ['required', Rule::in(['grid', 'slider'])],
                    "{$s}.props.columns" => ['required', 'integer', Rule::in(self::COLUMNS)],
                    "{$s}.props.show_view_all" => ['required', 'boolean'],
                ],
                'features' => $rules += [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.items" => ['required', 'array', 'min:2', 'max:4'],
                    "{$s}.props.items.*.icon" => ['required', Rule::in(self::ICONS)],
                    "{$s}.props.items.*.title" => $text(40, true),
                    "{$s}.props.items.*.text" => $text(120),
                ],
                'testimonials' => $rules += [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.source" => ['required', Rule::in(['auto', 'manual'])],
                    "{$s}.props.items" => [($props['source'] ?? null) === 'manual' ? 'required' : 'present', 'array', ($props['source'] ?? null) === 'manual' ? 'min:1' : 'min:0', 'max:12'],
                    "{$s}.props.items.*.name" => $text(60, true),
                    "{$s}.props.items.*.rating" => ['required', 'integer', 'between:1,5'],
                    "{$s}.props.items.*.text" => $text(400, true),
                ],
                default => null,
            };
        }

        return $rules;
    }

    /**
     * @param  array<string, mixed>  $props
     * @return array<string, mixed>
     */
    private function bannerRules(string $s, array $props, \Closure $text): array
    {
        $rules = [
            "{$s}.props.slides" => ['present', 'array', 'max:8'],
            "{$s}.props.autoplay" => ['required', 'boolean'],
        ];
        foreach (array_values((array) ($props['slides'] ?? [])) as $j => $slide) {
            $k = "{$s}.props.slides.{$j}";
            $type = is_array($slide) ? ($slide['link']['type'] ?? 'none') : 'none';
            $rules += [
                "{$k}.media_id" => ['required', 'integer', TenantExists::table('media')],
                "{$k}.title" => $text(80),
                "{$k}.text" => $text(200),
                "{$k}.button_label" => $text(30),
                "{$k}.link.type" => ['required', Rule::in(self::LINK_TYPES)],
                "{$k}.link.target_id" => match ($type) {
                    'category' => ['required', 'integer', TenantExists::table('categories')],
                    'product' => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
                    default => ['nullable'],
                },
                "{$k}.link.url" => $type === 'url' ? ['required', 'string', 'max:500', new SafeUrl] : ['nullable'],
            ];
        }

        return $rules;
    }

    /**
     * Arabic names for the error messages (by the last key of each field).
     *
     * @param  array<string, mixed>  $design
     * @return array<string, string>
     */
    private function attributes(array $design, string $p): array
    {
        $names = (array) __('design.attributes');
        $out = [];
        foreach (array_keys($this->rules($design, $p)) as $key) {
            $last = (string) last(explode('.', $key));
            $name = $last === 'text' && str_contains($key, '.colors.') ? 'text_color' : $last;
            if (isset($names[$name])) {
                $out[$key] = (string) $names[$name];
            }
        }

        return $out;
    }

    /**
     * Only the known keys, texts cleaned (validated data still carries nothing else, but
     * nested objects are rebuilt explicitly so the stored shape is always the same).
     *
     * @param  array<string, mixed>  $d
     * @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    private function clean(array $d): array
    {
        $s = $d['settings'];
        $str = fn (mixed $v): ?string => is_string($v) && trim(strip_tags($v)) !== '' ? trim(strip_tags($v)) : null;
        $int = fn (mixed $v): ?int => $v === null || $v === '' ? null : (int) $v;

        $settings = [
            'colors' => array_map(fn ($c) => strtolower((string) $c), array_intersect_key((array) $s['colors'], self::DEFAULT_COLORS)),
            'font' => (string) $s['font'],
            'font_size' => (string) $s['font_size'],
            'logo_media_id' => $int($s['logo_media_id'] ?? null),
            'favicon_media_id' => $int($s['favicon_media_id'] ?? null),
            'header' => ['sticky' => (bool) $s['header']['sticky'], 'search' => (bool) $s['header']['search'], 'announcement' => $str($s['header']['announcement'] ?? null)],
            'footer' => [
                'about' => $str($s['footer']['about'] ?? null),
                'show_pages' => (bool) $s['footer']['show_pages'],
                'phone' => $str($s['footer']['phone'] ?? null),
                'whatsapp' => $str($s['footer']['whatsapp'] ?? null),
                'email' => $str($s['footer']['email'] ?? null),
                'address' => $str($s['footer']['address'] ?? null),
                'social' => array_combine(self::SOCIAL, array_map(fn ($n) => $str($s['footer']['social'][$n] ?? null), self::SOCIAL)),
            ],
            'general' => [
                'whatsapp_button' => (bool) $s['general']['whatsapp_button'],
                'show_out_of_stock' => (bool) $s['general']['show_out_of_stock'],
                'products_per_page' => (int) $s['general']['products_per_page'],
            ],
        ];

        $sections = [];
        foreach (array_values((array) $d['sections']) as $section) {
            $p = (array) $section['props'];
            $props = match ($section['type']) {
                'banner' => [
                    'slides' => array_values(array_map(fn (array $slide) => [
                        'media_id' => (int) $slide['media_id'],
                        'title' => $str($slide['title'] ?? null),
                        'text' => $str($slide['text'] ?? null),
                        'button_label' => $str($slide['button_label'] ?? null),
                        'link' => [
                            'type' => (string) $slide['link']['type'],
                            'target_id' => in_array($slide['link']['type'], ['category', 'product'], true) ? (int) $slide['link']['target_id'] : null,
                            'url' => $slide['link']['type'] === 'url' ? trim((string) $slide['link']['url']) : null,
                        ],
                    ], (array) ($p['slides'] ?? []))),
                    'autoplay' => (bool) $p['autoplay'],
                ],
                'products' => [
                    'title' => (string) $str($p['title']),
                    'description' => $str($p['description'] ?? null),
                    'source' => (string) $p['source'],
                    'category_id' => $p['source'] === 'category' ? (int) $p['category_id'] : null,
                    'limit' => (int) $p['limit'],
                    'layout' => (string) $p['layout'],
                    'columns' => (int) $p['columns'],
                    'show_view_all' => (bool) $p['show_view_all'],
                ],
                'features' => [
                    'title' => $str($p['title'] ?? null),
                    'items' => array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'title' => (string) $str($i['title']), 'text' => $str($i['text'] ?? null)], (array) $p['items'])),
                ],
                'testimonials' => [
                    'title' => $str($p['title'] ?? null),
                    'source' => (string) $p['source'],
                    'items' => array_values(array_map(fn (array $i) => ['name' => (string) $str($i['name']), 'rating' => (int) $i['rating'], 'text' => (string) $str($i['text'])], (array) ($p['items'] ?? []))),
                ],
            };
            $sections[] = ['id' => (string) $section['id'], 'type' => (string) $section['type'], 'visible' => (bool) $section['visible'], 'props' => $props];
        }

        return ['settings' => $settings, 'sections' => $sections];
    }
}
