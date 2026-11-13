<?php

declare(strict_types=1);

namespace App\Themes;

use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use App\Support\OrderForm;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * «بداية», the free landing theme: what a page on it may hold (theme settings + sections, with
 * exactly one order form), the starter content, and the validation + clean-up of every save.
 * Same contract as «أساس» (App\Store\Design\AsasDesign): unknown keys are dropped, texts are
 * trimmed and stripped of tags. Images are *_media_id(s) keys so the page media links follow.
 */
final class BidayaDesign
{
    public const KEY = 'bidaya';

    public const SECTION_TYPES = ['hero', 'features', 'gallery', 'testimonials', 'faq', 'order_form'];

    public const MAX_SECTIONS = 12;

    public const FONT_SIZES = ['small', 'medium', 'large'];

    public const BUTTONS = ['rounded', 'pill', 'square'];

    public const ICONS = ['truck', 'cash', 'return', 'shield', 'support', 'gift', 'star', 'clock', 'tag', 'heart', 'package', 'phone'];

    public const SOCIAL = ['facebook', 'instagram', 'tiktok', 'x', 'youtube', 'snapchat'];

    /** Order form fields the merchant can switch (name and phone are always asked). */
    public const FORM_FIELDS = ['phone2', 'email', 'governorate', 'city', 'address', 'notes'];

    public const DEFAULT_COLORS = ['primary' => '#0b875b', 'secondary' => '#ffc83d', 'background' => '#ffffff', 'text' => '#13261d'];

    /**
     * A new page: the five sections and the order form, with the product name on top.
     *
     * @return array{version: int, settings: array<string, mixed>, sections: list<array<string, mixed>>}
     */
    public static function defaults(?string $productName = null): array
    {
        return [
            'version' => 1,
            'settings' => [
                'colors' => self::DEFAULT_COLORS,
                'font' => 'cairo',
                'font_size' => 'medium',
                'button' => 'rounded',
                'logo_media_id' => null,
                'header' => ['show' => true, 'announcement' => null],
                'footer' => ['text' => null, 'phone' => null, 'whatsapp' => null, 'social' => array_fill_keys(self::SOCIAL, null)],
                'general' => ['sticky_order_button' => true, 'whatsapp_button' => false],
            ],
            'sections' => [
                self::section('hero', [
                    'title' => $productName ?? (string) __('bidaya.hero_title'),
                    'subtitle' => (string) __('bidaya.hero_subtitle'),
                    'image_media_id' => null,
                    'show_price' => true,
                    'button_label' => (string) __('bidaya.order_now'),
                    'badge' => null,
                ]),
                self::section('features', ['title' => (string) __('bidaya.features_title'), 'items' => (array) __('bidaya.features')]),
                self::section('gallery', ['title' => (string) __('bidaya.gallery_title'), 'image_media_ids' => []]),
                self::section('testimonials', ['title' => (string) __('bidaya.testimonials_title'), 'source' => 'auto', 'items' => []]),
                self::section('faq', ['title' => (string) __('bidaya.faq_title'), 'items' => (array) __('bidaya.faq')]),
                self::section('order_form', self::orderFormDefaults()),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function orderFormDefaults(): array
    {
        return [
            'title' => (string) __('bidaya.form_title'),
            'subtitle' => (string) __('bidaya.form_subtitle'),
            'button_label' => (string) __('bidaya.form_button'),
            'fields' => self::fields([]),
            'offer_picker' => true,
            'show_quantity' => true,
        ];
    }

    /** @param array<string, mixed> $props @return array<string, mixed> */
    private static function section(string $type, array $props): array
    {
        return ['id' => substr(bin2hex(random_bytes(6)), 0, 12), 'type' => $type, 'visible' => true, 'props' => $props];
    }

    /**
     * The order form fields in the shape App\Support\OrderForm reads (name and phone locked on).
     *
     * @param  array<string, mixed>  $given
     * @return array<string, array{enabled: bool, required: bool}>
     */
    private static function fields(array $given): array
    {
        $out = [];
        foreach (OrderForm::BUILT_IN as $key) {
            $default = OrderForm::DEFAULT_FIELDS[$key];
            $row = is_array($given[$key] ?? null) ? $given[$key] : $default;
            $locked = in_array($key, OrderForm::LOCKED, true);
            $enabled = $locked || (bool) ($row['enabled'] ?? false);
            $out[$key] = ['enabled' => $enabled, 'required' => $locked || ($enabled && (bool) ($row['required'] ?? false))];
        }

        return $out;
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
        $data = [$prefix => is_array($content) ? $content : []];
        $validator = Validator::make($data, $this->rules($data[$prefix], $prefix), [], $this->attributes($data[$prefix], $prefix));
        $validator->after(function ($v) use ($data, $prefix): void {
            $seen = [];
            $forms = 0;
            foreach (array_values((array) ($data[$prefix]['sections'] ?? [])) as $i => $section) {
                $id = is_array($section) ? ($section['id'] ?? null) : null;
                if (is_string($id) && isset($seen[$id])) {
                    $v->errors()->add("{$prefix}.sections.{$i}.id", __('validation.distinct', ['attribute' => 'id']));
                }
                $seen[(string) $id] = true;
                if (is_array($section) && ($section['type'] ?? null) === 'order_form') {
                    $forms++;
                    if (($section['visible'] ?? true) !== true) {
                        $v->errors()->add("{$prefix}.sections.{$i}.visible", __('bidaya.form_hidden'));
                    }
                }
            }
            // The page sells through its form: exactly one, always shown.
            if ($forms !== 1) {
                $v->errors()->add("{$prefix}.sections", __('bidaya.form_count'));
            }
        });
        $validator->validate();

        return $this->clean($validator->validated()[$prefix]);
    }

    /** @param array<string, mixed> $content @return array<string, mixed> */
    private function rules(array $content, string $p): array
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
            "{$p}.settings.button" => ['required', Rule::in(self::BUTTONS)],
            "{$p}.settings.logo_media_id" => $media,
            "{$p}.settings.header.show" => ['required', 'boolean'],
            "{$p}.settings.header.announcement" => $text(200),
            "{$p}.settings.footer.text" => $text(300),
            "{$p}.settings.footer.phone" => $text(30),
            "{$p}.settings.footer.whatsapp" => $text(30),
            "{$p}.settings.general.sticky_order_button" => ['required', 'boolean'],
            "{$p}.settings.general.whatsapp_button" => ['required', 'boolean'],
            "{$p}.sections" => ['required', 'array', 'min:1', 'max:'.self::MAX_SECTIONS],
        ];
        foreach (self::SOCIAL as $network) {
            $rules["{$p}.settings.footer.social.{$network}"] = ['nullable', 'string', 'max:300', new SafeUrl];
        }

        foreach (array_values((array) ($content['sections'] ?? [])) as $i => $section) {
            $s = "{$p}.sections.{$i}";
            $rules["{$s}.id"] = ['required', 'string', 'regex:/^[A-Za-z0-9_-]{6,40}$/'];
            $rules["{$s}.type"] = ['required', Rule::in(self::SECTION_TYPES)];
            $rules["{$s}.visible"] = ['required', 'boolean'];
            $rules["{$s}.props"] = ['required', 'array'];
            $props = (array) (is_array($section) ? ($section['props'] ?? []) : []);

            match (is_array($section) ? ($section['type'] ?? null) : null) {
                'hero' => $rules += [
                    "{$s}.props.title" => $text(120, true),
                    "{$s}.props.subtitle" => $text(300),
                    "{$s}.props.image_media_id" => $media,
                    "{$s}.props.show_price" => ['required', 'boolean'],
                    "{$s}.props.button_label" => $text(40, true),
                    "{$s}.props.badge" => $text(40),
                ],
                'features' => $rules += [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.items" => ['required', 'array', 'min:2', 'max:6'],
                    "{$s}.props.items.*.icon" => ['required', Rule::in(self::ICONS)],
                    "{$s}.props.items.*.title" => $text(40, true),
                    "{$s}.props.items.*.text" => $text(120),
                ],
                'gallery' => $rules += [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.image_media_ids" => ['present', 'array', 'max:12'],
                    "{$s}.props.image_media_ids.*" => ['integer', 'distinct', TenantExists::table('media')],
                ],
                'testimonials' => $rules += [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.source" => ['required', Rule::in(['auto', 'manual'])],
                    "{$s}.props.items" => [($props['source'] ?? null) === 'manual' ? 'required' : 'present', 'array', ($props['source'] ?? null) === 'manual' ? 'min:1' : 'min:0', 'max:12'],
                    "{$s}.props.items.*.name" => $text(60, true),
                    "{$s}.props.items.*.rating" => ['required', 'integer', 'between:1,5'],
                    "{$s}.props.items.*.text" => $text(400, true),
                ],
                'faq' => $rules += [
                    "{$s}.props.title" => $text(80),
                    "{$s}.props.items" => ['required', 'array', 'min:1', 'max:12'],
                    "{$s}.props.items.*.question" => $text(150, true),
                    "{$s}.props.items.*.answer" => $text(600, true),
                ],
                'order_form' => $rules += [
                    "{$s}.props.title" => $text(80, true),
                    "{$s}.props.subtitle" => $text(200),
                    "{$s}.props.button_label" => $text(40, true),
                    "{$s}.props.fields" => ['required', 'array'],
                    "{$s}.props.offer_picker" => ['required', 'boolean'],
                    "{$s}.props.show_quantity" => ['required', 'boolean'],
                ] + $this->fieldRules("{$s}.props.fields"),
                default => null,
            };
        }

        return $rules;
    }

    /** @return array<string, list<string>> */
    private function fieldRules(string $prefix): array
    {
        $rules = [];
        foreach (self::FORM_FIELDS as $key) {
            $rules["{$prefix}.{$key}.enabled"] = ['required', 'boolean'];
            $rules["{$prefix}.{$key}.required"] = ['required', 'boolean'];
        }

        return $rules;
    }

    /**
     * Arabic names for the error messages (by the last key of each field).
     *
     * @param  array<string, mixed>  $content
     * @return array<string, string>
     */
    private function attributes(array $content, string $p): array
    {
        $names = (array) __('design.attributes') + (array) __('bidaya.attributes');
        $out = [];
        foreach (array_keys($this->rules($content, $p)) as $key) {
            $last = (string) last(explode('.', $key));
            $name = $last === 'text' && str_contains($key, '.colors.') ? 'text_color' : $last;
            if (isset($names[$name])) {
                $out[$key] = (string) $names[$name];
            }
        }

        return $out;
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

        $settings = [
            'colors' => array_map(fn ($c) => strtolower((string) $c), array_intersect_key((array) $s['colors'], self::DEFAULT_COLORS)),
            'font' => (string) $s['font'],
            'font_size' => (string) $s['font_size'],
            'button' => (string) $s['button'],
            'logo_media_id' => $int($s['logo_media_id'] ?? null),
            'header' => ['show' => (bool) $s['header']['show'], 'announcement' => $str($s['header']['announcement'] ?? null)],
            'footer' => [
                'text' => $str($s['footer']['text'] ?? null),
                'phone' => $str($s['footer']['phone'] ?? null),
                'whatsapp' => $str($s['footer']['whatsapp'] ?? null),
                'social' => array_combine(self::SOCIAL, array_map(fn ($n) => $str($s['footer']['social'][$n] ?? null), self::SOCIAL)),
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
                    'title' => (string) $str($p['title']),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'image_media_id' => $int($p['image_media_id'] ?? null),
                    'show_price' => (bool) $p['show_price'],
                    'button_label' => (string) $str($p['button_label']),
                    'badge' => $str($p['badge'] ?? null),
                ],
                'features' => [
                    'title' => $str($p['title'] ?? null),
                    'items' => array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'title' => (string) $str($i['title']), 'text' => $str($i['text'] ?? null)], (array) $p['items'])),
                ],
                'gallery' => [
                    'title' => $str($p['title'] ?? null),
                    'image_media_ids' => array_values(array_map('intval', (array) ($p['image_media_ids'] ?? []))),
                ],
                'testimonials' => [
                    'title' => $str($p['title'] ?? null),
                    'source' => (string) $p['source'],
                    'items' => array_values(array_map(fn (array $i) => ['name' => (string) $str($i['name']), 'rating' => (int) $i['rating'], 'text' => (string) $str($i['text'])], (array) ($p['items'] ?? []))),
                ],
                'faq' => [
                    'title' => $str($p['title'] ?? null),
                    'items' => array_values(array_map(fn (array $i) => ['question' => (string) $str($i['question']), 'answer' => (string) $str($i['answer'])], (array) $p['items'])),
                ],
                'order_form' => [
                    'title' => (string) $str($p['title']),
                    'subtitle' => $str($p['subtitle'] ?? null),
                    'button_label' => (string) $str($p['button_label']),
                    'fields' => self::fields((array) $p['fields']),
                    'offer_picker' => (bool) $p['offer_picker'],
                    'show_quantity' => (bool) $p['show_quantity'],
                ],
            };
            $sections[] = ['id' => (string) $section['id'], 'type' => (string) $section['type'], 'visible' => (bool) $section['visible'], 'props' => $props];
        }

        return ['version' => 1, 'settings' => $settings, 'sections' => $sections];
    }
}
