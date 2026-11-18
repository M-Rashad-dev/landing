<?php

declare(strict_types=1);

namespace App\Themes\Store;

use App\Ai\Designer\AiSectionDefinitions;
use App\Ai\Designer\AiSectionFields;
use App\Models\AiSection;
use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The contract of a store theme's design: the starter design, the home section types it offers,
 * its settings groups, and the validation + clean-up of every save (unknown keys dropped, texts
 * trimmed and without tags). The machinery is here once; a theme only says what it has:
 *
 *  - SECTION_TYPES / MAX_SECTIONS: the home sections (rules and storage in StoreSections),
 *  - SETTINGS_GROUPS: the groups of settings the Builder shows for it,
 *  - settingsRules() / cleanSettings(): its settings, usually the base ones plus its own,
 *  - defaults(): the design a store starts with.
 *
 * Registered in StoreThemes; nothing else picks by theme key.
 */
abstract class StoreThemeDesign
{
    /** The theme key ({design}_store). */
    public const KEY = '';

    /** @var list<string> */
    public const SECTION_TYPES = [];

    public const MAX_SECTIONS = 20;

    /**
     * The settings groups of this theme (the Builder shows a panel for each). Every store theme
     * has look, header, footer and general; product_card, product_page, listing and cart are for
     * the themes that draw those their own way.
     *
     * @var list<string>
     */
    public const SETTINGS_GROUPS = ['look', 'header', 'footer', 'general'];

    public const FONT_SIZES = ['small', 'medium', 'large'];

    public const PER_PAGE = [12, 16, 24, 32, 48];

    public const SOCIAL = ['facebook', 'instagram', 'tiktok', 'x', 'youtube', 'snapchat'];

    public const COLOR_KEYS = ['primary', 'secondary', 'background', 'text'];

    public function __construct(protected readonly StoreSections $sections) {}

    /** @return array{settings: array<string, mixed>, sections: list<array<string, mixed>>} */
    abstract public function defaults(?int $logoMediaId = null): array;

    /**
     * The rules of this theme's settings ($p = "draft").
     *
     * @param  array<string, mixed>  $settings  what was sent (for rules that depend on it)
     * @return array<string, mixed>
     */
    abstract protected function settingsRules(string $p, array $settings): array;

    /**
     * This theme's settings as they are stored (only known keys).
     *
     * @param  array<string, mixed>  $s  validated settings
     * @return array<string, mixed>
     */
    abstract protected function cleanSettings(array $s): array;

    /** @param array<string, mixed> $props @return array<string, mixed> */
    protected function sectionRules(string $type, string $s, array $props): array
    {
        return $this->sections->rules($type, $s, $props);
    }

    /** @param array<string, mixed> $p @return array<string, mixed> */
    protected function cleanSection(string $type, array $p): array
    {
        return $this->sections->clean($type, $p);
    }

    /** A new section with a random id. @param array<string, mixed> $props @return array<string, mixed> */
    public static function section(string $type, array $props): array
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
    final public function validate(mixed $design, string $prefix = 'draft'): array
    {
        $data = [$prefix => is_array($design) ? $design : []];
        $rawSections = array_values((array) ($data[$prefix]['sections'] ?? []));
        $aiSections = AiSectionDefinitions::loadSections($rawSections);
        $rules = $this->rules($data[$prefix], $prefix, $aiSections);
        $validator = Validator::make($data, $rules, [], self::attributeNames(array_keys($rules)));
        $validator->after(function ($v) use ($data, $prefix): void {
            // Each section id once (the Builder and the data map are keyed by it).
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

        $clean = $validator->validated()[$prefix];
        $sections = [];
        foreach (array_values((array) $clean['sections']) as $i => $section) {
            $type = (string) $section['type'];
            if ($type === 'ai') {
                $rawProps = is_array($rawSections[$i]['props'] ?? null) ? $rawSections[$i]['props'] : (array) $section['props'];
                $aiSectionId = (int) ($rawProps['ai_section_id'] ?? 0);
                $aiSection = $aiSections->get($aiSectionId);
                $fields = is_array($aiSection?->current?->fields) ? $aiSection->current->fields : [];
                $props = [
                    'ai_section_id' => $aiSectionId,
                    'values' => AiSectionFields::clean($fields, is_array($rawProps['values'] ?? null) ? $rawProps['values'] : [], 'store'),
                ];
            } else {
                $props = $this->cleanSection($type, (array) $section['props']);
            }
            $sections[] = ['id' => (string) $section['id'], 'type' => $type, 'visible' => (bool) $section['visible'], 'props' => $props];
        }

        return ['settings' => $this->cleanSettings((array) $clean['settings']), 'sections' => $sections];
    }

    /**
     * @param  array<string, mixed>  $design
     * @param  Collection<int, AiSection>  $aiSections
     * @return array<string, mixed>
     */
    private function rules(array $design, string $p, Collection $aiSections): array
    {
        $rules = [
            $p => ['required', 'array'],
            "{$p}.settings" => ['required', 'array'],
            ...$this->settingsRules($p, (array) ($design['settings'] ?? [])),
            "{$p}.sections" => ['present', 'array', 'max:'.static::MAX_SECTIONS],
        ];

        foreach (array_values((array) ($design['sections'] ?? [])) as $i => $section) {
            $s = "{$p}.sections.{$i}";
            $rules["{$s}.id"] = ['required', 'string', 'regex:/^[A-Za-z0-9_-]{6,40}$/'];
            $rules["{$s}.type"] = ['required', Rule::in([...static::SECTION_TYPES, 'ai'])];
            $rules["{$s}.visible"] = ['required', 'boolean'];
            $rules["{$s}.props"] = ['required', 'array'];
            $type = is_array($section) ? ($section['type'] ?? null) : null;
            if ($type === 'ai') {
                $props = is_array($section['props'] ?? null) ? $section['props'] : [];
                $rawId = $props['ai_section_id'] ?? null;
                $aiSection = (is_int($rawId) || (is_string($rawId) && ctype_digit($rawId)))
                    ? $aiSections->get((int) $rawId)
                    : null;
                $validAiSection = ($aiSection instanceof AiSection
                    && $aiSection->kind === 'store'
                    && $aiSection->theme_key === static::KEY
                    && $aiSection->current !== null)
                    ? $aiSection
                    : null;

                $rules["{$s}.props.ai_section_id"] = [
                    'required',
                    'integer',
                    static function (string $attribute, mixed $value, Closure $fail) use ($validAiSection): void {
                        if ($validAiSection === null) {
                            $fail(__('ai.sections.wrong_theme'));
                        }
                    },
                ];
                $rules["{$s}.props.values"] = ['present', 'array'];
                if ($validAiSection !== null) {
                    $rules += AiSectionFields::rules((array) $validAiSection->current->fields, "{$s}.props.values", 'store');
                }
            } elseif (is_string($type) && in_array($type, static::SECTION_TYPES, true)) {
                $rules += $this->sectionRules($type, $s, (array) ($section['props'] ?? []));
            }
        }

        return $rules;
    }

    /**
     * The settings every store theme has (colors, font, logo, header, footer, lists).
     *
     * @return array<string, mixed>
     */
    protected function baseSettingsRules(string $p): array
    {
        $text = StoreSections::text(...);
        $color = ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
        $media = ['nullable', 'integer', TenantExists::table('media')];

        $rules = [
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
        ];
        foreach (self::COLOR_KEYS as $key) {
            $rules["{$p}.settings.colors.{$key}"] = $color;
        }
        foreach (self::SOCIAL as $network) {
            $rules["{$p}.settings.footer.social.{$network}"] = ['nullable', 'string', 'max:300', new SafeUrl];
        }

        return $rules;
    }

    /**
     * The base settings, rebuilt with only the known keys.
     *
     * @param  array<string, mixed>  $s
     * @return array<string, mixed>
     */
    protected function cleanBaseSettings(array $s): array
    {
        $str = StoreSections::str(...);
        $int = fn (mixed $v): ?int => $v === null || $v === '' ? null : (int) $v;

        return [
            'colors' => array_map(fn ($c) => strtolower((string) $c), array_intersect_key((array) $s['colors'], array_flip(self::COLOR_KEYS))),
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
    }

    /**
     * The base settings of a new store (each theme sets its own colors and font on top).
     *
     * @return array<string, mixed>
     */
    protected static function baseDefaults(?int $logoMediaId): array
    {
        return [
            'colors' => ['primary' => '#0b875b', 'secondary' => '#ffc83d', 'background' => '#ffffff', 'text' => '#13261d'],
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
        ];
    }

    /**
     * Arabic names for the error messages (by the last key of each field).
     *
     * @param  list<string>  $keys
     * @return array<string, string>
     */
    public static function attributeNames(array $keys): array
    {
        $names = (array) __('design.attributes');
        $out = [];
        foreach ($keys as $key) {
            $last = (string) last(explode('.', $key));
            $name = $last === 'text' && str_contains($key, '.colors.') ? 'text_color' : $last;
            if (isset($names[$name])) {
                $out[$key] = (string) $names[$name];
            }
        }

        return $out;
    }
}
