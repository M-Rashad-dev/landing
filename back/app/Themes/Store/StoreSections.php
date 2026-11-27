<?php

declare(strict_types=1);

namespace App\Themes\Store;

use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Every home section type a store theme can use, in one place: its validation rules and how it is
 * stored (only known keys, texts without tags). A theme lists the types it offers
 * (StoreThemeDesign::SECTION_TYPES) and may extend one (e.g. «صوفي»'s reviews add a layout).
 * A new section type is added here once, then any store theme can offer it.
 */
final class StoreSections
{
    public const PRODUCT_SOURCES = ['latest', 'offers', 'category'];

    public const PRODUCT_LIMITS = [4, 8, 12, 16, 24, 32];

    public const COLUMNS = [2, 3, 4, 5];

    public const ICONS = ['truck', 'cash', 'return', 'shield', 'support', 'gift', 'star', 'clock', 'tag', 'heart', 'package', 'phone'];

    /** Food themes add their own icons to the base ones. */
    public const FOOD_ICONS = [...self::ICONS, 'flame', 'chef', 'leaf', 'utensils', 'meat', 'timer', 'thermo', 'bike', 'soup', 'sparkle'];

    /** Where a section's button or picture leads (the AI sections keep these). */
    public const BASE_LINK_TYPES = ['none', 'all_products', 'offers', 'category', 'product', 'url'];

    /** The theme sections add «بحث بكلمة»: the store's search for a word (an ingredient, a brand…). */
    public const LINK_TYPES = [...self::BASE_LINK_TYPES, 'search'];

    /** «مواعيد العمل»: one row per day, Saturday first (the Egyptian week). */
    public const WEEK_DAYS = 7;

    public const TIME = 'regex:/^([01]\d|2[0-3]):[0-5]\d$/';

    public const HERO_HEIGHTS = ['full', 'large', 'medium'];

    public const TAB_SOURCES = ['latest', 'offers', 'category', 'manual'];

    public const MARQUEE_SPEEDS = ['slow', 'normal', 'fast'];

    public const CATEGORY_SHAPES = ['circle', 'square', 'card'];

    /** «اختصارات» (skin types, concerns…): round tiles or colored cards, each opening a link. */
    public const SHORTCUT_STYLES = ['circles', 'cards'];

    /** A «اشترك» band: opens the store's WhatsApp with a ready message, or a link. */
    public const CTA_ACTIONS = ['whatsapp', 'link'];

    /** Where the quiz's AI add-on picks products from: the whole store, some categories, or the merchant's list. */
    public const QUIZ_AI_SCOPES = ['all', 'categories', 'products'];

    /** The quiz's AI add-on as a new quiz (or one saved before it) has it: off. */
    public const QUIZ_AI_DEFAULTS = ['enabled' => false, 'open_question' => true, 'open_label' => null, 'scope' => 'all', 'category_ids' => [], 'product_ids' => []];

    public const HEX = 'regex:/^#[0-9a-fA-F]{6}$/';

    public const VIDEO_HOSTS = '#^https://(www\.|m\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)/#i';

    public const MAP_HOSTS = '#^https://(www\.)?(google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl/maps)#i';

    /** A text field: optional (or required) string up to $max characters. */
    public static function text(int $max, bool $required = false): array
    {
        return [$required ? 'required' : 'nullable', 'string', 'max:'.$max];
    }

    /** A text without tags, null when empty. */
    public static function str(mixed $v): ?string
    {
        return is_string($v) && trim(strip_tags($v)) !== '' ? trim(strip_tags($v)) : null;
    }

    /** An image of the store's library (required or not). */
    public static function media(bool $required = true): array
    {
        return [$required ? 'required' : 'nullable', 'integer', TenantExists::table('media')];
    }

    /** @param array<string, mixed> $link @return array<string, mixed> */
    public static function linkRules(string $k, array $link): array
    {
        $type = $link['type'] ?? 'none';

        return [
            "{$k}.type" => ['required', Rule::in(self::LINK_TYPES)],
            "{$k}.target_id" => match ($type) {
                'category' => ['required', 'integer', TenantExists::table('categories')],
                'product' => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
                default => ['nullable'],
            },
            "{$k}.url" => match ($type) {
                'url' => ['required', 'string', 'max:500', new SafeUrl],
                'search' => ['required', 'string', 'max:60'],
                default => ['nullable'],
            },
        ];
    }

    /**
     * @param  array{type: string, target_id?: mixed, url?: mixed}  $link
     * @return array{type: string, target_id: int|null, url: string|null}
     */
    public static function cleanLink(array $link): array
    {
        return [
            'type' => (string) $link['type'],
            'target_id' => in_array($link['type'], ['category', 'product'], true) ? (int) $link['target_id'] : null,
            'url' => match ($link['type']) {
                'url' => trim((string) $link['url']),
                'search' => (string) self::str($link['url']),
                default => null,
            },
        ];
    }

    /**
     * The rules of one section of this type ($s = "draft.sections.3").
     *
     * @param  array<string, mixed>  $props
     * @return array<string, mixed>
     */
    public function rules(string $type, string $s, array $props): array
    {
        $text = self::text(...);
        $media = self::media(...);

        return match ($type) {
            'banner' => $this->slidesRules($s, $props),
            'hero' => [
                ...$this->slidesRules($s, $props),
                "{$s}.props.height" => ['required', Rule::in(self::HERO_HEIGHTS)],
                "{$s}.props.merge_header" => ['required', 'boolean'],
                "{$s}.props.shade" => ['required', 'integer', 'between:0,80'],
                "{$s}.props.kicker" => $text(40),
            ],
            'products' => [
                "{$s}.props.title" => $text(80, true),
                "{$s}.props.description" => $text(200),
                "{$s}.props.source" => ['required', Rule::in(self::PRODUCT_SOURCES)],
                "{$s}.props.category_id" => [($props['source'] ?? null) === 'category' ? 'required' : 'nullable', 'integer', TenantExists::table('categories')],
                "{$s}.props.limit" => ['required', 'integer', Rule::in(self::PRODUCT_LIMITS)],
                "{$s}.props.layout" => ['required', Rule::in(['grid', 'slider'])],
                "{$s}.props.columns" => ['required', 'integer', Rule::in(self::COLUMNS)],
                "{$s}.props.show_view_all" => ['required', 'boolean'],
            ],
            'features' => [
                "{$s}.props.title" => $text(80),
                "{$s}.props.items" => ['required', 'array', 'min:2', 'max:4'],
                "{$s}.props.items.*.icon" => ['required', Rule::in(self::ICONS)],
                "{$s}.props.items.*.title" => $text(40, true),
                "{$s}.props.items.*.text" => $text(120),
            ],
            'testimonials' => [
                "{$s}.props.title" => $text(80),
                "{$s}.props.source" => ['required', Rule::in(['auto', 'manual'])],
                "{$s}.props.items" => [($props['source'] ?? null) === 'manual' ? 'required' : 'present', 'array', ($props['source'] ?? null) === 'manual' ? 'min:1' : 'min:0', 'max:12'],
                "{$s}.props.items.*.name" => $text(60, true),
                "{$s}.props.items.*.rating" => ['required', 'integer', 'between:1,5'],
                "{$s}.props.items.*.text" => $text(400, true),
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
            'product_tabs' => $this->tabsRules($s, $props),
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
                ...self::linkRules("{$s}.props.link", (array) ($props['link'] ?? [])),
                "{$s}.props.ends_at" => ['required', 'date'],
                "{$s}.props.on_end" => ['required', Rule::in(['hide', 'ended'])],
            ],
            'featured_product' => [
                "{$s}.props.product_id" => ['required', 'integer', TenantExists::table('products')->ignoreTrashed()],
                "{$s}.props.kicker" => $text(40),
            ],
            'video' => [
                "{$s}.props.url" => ['required', 'string', 'max:300', new SafeUrl, 'regex:'.self::VIDEO_HOSTS],
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
                ...self::linkRules("{$s}.props.link", (array) ($props['link'] ?? [])),
            ],
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
            'food_hero' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(100, true),
                "{$s}.props.highlight" => $text(40),
                "{$s}.props.subtitle" => $text(300),
                "{$s}.props.media_id" => $media(false),
                "{$s}.props.stickers" => ['present', 'array', 'max:2'],
                "{$s}.props.stickers.*" => $text(30, true),
                "{$s}.props.badge" => $text(20),
                "{$s}.props.primary_label" => $text(30, true),
                ...self::linkRules("{$s}.props.primary_link", (array) ($props['primary_link'] ?? [])),
                "{$s}.props.second_label" => $text(30),
                ...self::linkRules("{$s}.props.second_link", (array) ($props['second_link'] ?? [])),
                "{$s}.props.trust" => ['present', 'array', 'max:4'],
                "{$s}.props.trust.*.icon" => ['required', Rule::in(self::FOOD_ICONS)],
                "{$s}.props.trust.*.text" => $text(40, true),
            ],
            'why' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                "{$s}.props.subtitle" => $text(200),
                "{$s}.props.media_id" => $media(false),
                "{$s}.props.quote" => $text(200),
                ...$this->iconItems($s, 2, 6),
            ],
            'steps' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                ...$this->iconItems($s, 2, 5),
            ],
            'bundles' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                "{$s}.props.subtitle" => $text(200),
                "{$s}.props.cards" => ['required', 'array', 'min:1', 'max:4'],
                "{$s}.props.cards.*.offer_id" => ['required', 'integer', TenantExists::table('offers')],
                "{$s}.props.cards.*.media_id" => $media(false),
                "{$s}.props.cards.*.title" => $text(60, true),
                "{$s}.props.cards.*.subtitle" => $text(80),
                "{$s}.props.cards.*.points" => ['present', 'array', 'max:5'],
                "{$s}.props.cards.*.points.*" => $text(60, true),
                "{$s}.props.cards.*.ribbon" => $text(24),
                "{$s}.props.cards.*.button_label" => $text(30),
            ],
            'hours' => [
                "{$s}.props.title" => $text(80),
                "{$s}.props.subtitle" => $text(200),
                "{$s}.props.days" => ['required', 'array', 'size:'.self::WEEK_DAYS],
                "{$s}.props.days.*.open" => ['required', 'boolean'],
                "{$s}.props.days.*.from" => ['required', 'string', self::TIME],
                "{$s}.props.days.*.to" => ['required', 'string', self::TIME],
                "{$s}.props.open_message" => $text(160, true),
                "{$s}.props.closed_message" => $text(160, true),
            ],
            'glow_hero' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(100, true),
                "{$s}.props.highlight" => $text(40),
                "{$s}.props.subtitle" => $text(300),
                "{$s}.props.media_id" => $media(false),
                "{$s}.props.badge" => $text(20),
                "{$s}.props.rating" => $text(40),
                "{$s}.props.primary_label" => $text(30, true),
                ...self::linkRules("{$s}.props.primary_link", (array) ($props['primary_link'] ?? [])),
                "{$s}.props.second_label" => $text(30),
                ...self::linkRules("{$s}.props.second_link", (array) ($props['second_link'] ?? [])),
                "{$s}.props.chips" => ['present', 'array', 'max:4'],
                "{$s}.props.chips.*" => $text(30, true),
            ],
            'shortcuts' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                "{$s}.props.description" => $text(200),
                "{$s}.props.style" => ['required', Rule::in(self::SHORTCUT_STYLES)],
                "{$s}.props.items" => ['required', 'array', 'min:2', 'max:12'],
                ...$this->itemsWithLinks($s, $props, fn (string $k) => [
                    "{$k}.label" => $text(40, true),
                    "{$k}.text" => $text(80),
                    "{$k}.media_id" => $media(false),
                    "{$k}.color" => ['nullable', 'string', self::HEX],
                ]),
            ],
            'routine' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80, true),
                "{$s}.props.text" => $text(300),
                "{$s}.props.button_label" => $text(30),
                "{$s}.props.steps" => ['required', 'array', 'min:2', 'max:4'],
                "{$s}.props.steps.*.product_id" => ['required', 'integer', 'distinct', TenantExists::table('products')->ignoreTrashed()],
                "{$s}.props.steps.*.label" => $text(30),
                "{$s}.props.steps.*.hint" => $text(40),
            ],
            'reels' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                "{$s}.props.items" => ['required', 'array', 'min:1', 'max:10'],
                "{$s}.props.items.*.url" => ['required', 'string', 'max:300', new SafeUrl, 'regex:'.self::VIDEO_HOSTS],
                "{$s}.props.items.*.title" => $text(60),
                "{$s}.props.items.*.cover_media_id" => $media(false),
            ],
            'ingredients' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                "{$s}.props.description" => $text(200),
                "{$s}.props.items" => ['required', 'array', 'min:2', 'max:8'],
                ...$this->itemsWithLinks($s, $props, fn (string $k) => [
                    "{$k}.symbol" => $text(4, true),
                    "{$k}.name" => $text(40, true),
                    "{$k}.text" => $text(100),
                    "{$k}.color" => ['nullable', 'string', self::HEX],
                ]),
            ],
            'before_after' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                "{$s}.props.text" => $text(300),
                "{$s}.props.before_media_id" => $media(),
                "{$s}.props.after_media_id" => $media(),
                "{$s}.props.before_label" => $text(20, true),
                "{$s}.props.after_label" => $text(20, true),
                "{$s}.props.facts" => ['present', 'array', 'max:3'],
                "{$s}.props.facts.*.value" => $text(12, true),
                "{$s}.props.facts.*.label" => $text(40, true),
            ],
            'skin_quiz' => $this->quizRules($s, $props),
            'articles' => [
                "{$s}.props.kicker" => $text(40),
                "{$s}.props.title" => $text(80),
                "{$s}.props.items" => ['required', 'array', 'min:1', 'max:6'],
                ...$this->itemsWithLinks($s, $props, fn (string $k) => [
                    "{$k}.media_id" => $media(false),
                    "{$k}.tag" => $text(30),
                    "{$k}.title" => $text(80, true),
                    "{$k}.body" => $text(3000),
                ]),
            ],
            'cta' => [
                "{$s}.props.title" => $text(80, true),
                "{$s}.props.text" => $text(200),
                "{$s}.props.button_label" => $text(30, true),
                "{$s}.props.action" => ['required', Rule::in(self::CTA_ACTIONS)],
                "{$s}.props.message" => $text(200),
                ...self::linkRules("{$s}.props.link", (array) ($props['link'] ?? [])),
            ],
            'location' => [
                "{$s}.props.title" => $text(80),
                "{$s}.props.description" => $text(200),
                "{$s}.props.branches" => ['required', 'array', 'min:1', 'max:6'],
                "{$s}.props.branches.*.name" => $text(60, true),
                "{$s}.props.branches.*.address" => $text(200, true),
                "{$s}.props.branches.*.hours" => $text(60),
                "{$s}.props.branches.*.phone" => $text(30),
                "{$s}.props.branches.*.map_url" => ['required', 'string', 'max:500', new SafeUrl, 'regex:'.self::MAP_HOSTS],
            ],
            default => [],
        };
    }

    /**
     * One section of this type as it is stored.
     *
     * @param  array<string, mixed>  $p
     * @return array<string, mixed>
     */
    public function clean(string $type, array $p): array
    {
        $str = self::str(...);
        $mediaOrNull = fn (mixed $v): ?int => $v === null || $v === '' ? null : (int) $v;
        $items = fn (\Closure $map) => array_values(array_map($map, (array) ($p['items'] ?? [])));

        return match ($type) {
            'banner' => [
                'slides' => array_values(array_map(fn (array $slide) => [
                    'media_id' => (int) $slide['media_id'],
                    'title' => $str($slide['title'] ?? null),
                    'text' => $str($slide['text'] ?? null),
                    'button_label' => $str($slide['button_label'] ?? null),
                    'link' => self::cleanLink((array) $slide['link']),
                ], (array) ($p['slides'] ?? []))),
                'autoplay' => (bool) $p['autoplay'],
            ],
            'hero' => [
                ...$this->clean('banner', $p),
                'height' => (string) $p['height'],
                'merge_header' => (bool) $p['merge_header'],
                'shade' => (int) $p['shade'],
                'kicker' => $str($p['kicker'] ?? null),
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
                'link' => self::cleanLink((array) $i['link']),
            ])],
            'countdown' => [
                'media_id' => $mediaOrNull($p['media_id'] ?? null),
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'text' => $str($p['text'] ?? null),
                'button_label' => $str($p['button_label'] ?? null),
                'link' => self::cleanLink((array) $p['link']),
                // Stored in UTC; the Builder sends the merchant's local time with its offset.
                'ends_at' => Carbon::parse((string) $p['ends_at'])->utc()->toIso8601ZuluString(),
                'on_end' => (string) $p['on_end'],
            ],
            'featured_product' => ['product_id' => (int) $p['product_id'], 'kicker' => $str($p['kicker'] ?? null)],
            'video' => [
                'url' => trim((string) $p['url']),
                'title' => $str($p['title'] ?? null),
                'text' => $str($p['text'] ?? null),
                'cover_media_id' => $mediaOrNull($p['cover_media_id'] ?? null),
            ],
            'brands' => ['title' => $str($p['title'] ?? null), 'items' => $items(fn (array $i) => ['media_id' => (int) $i['media_id'], 'name' => $str($i['name'] ?? null), 'link' => self::cleanLink((array) $i['link'])])],
            'story' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'text' => $str($p['text'] ?? null),
                'media_id' => (int) $p['media_id'],
                'media2_id' => $mediaOrNull($p['media2_id'] ?? null),
                'stats' => array_values(array_map(fn (array $x) => ['value' => (string) $str($x['value']), 'label' => (string) $str($x['label'])], (array) $p['stats'])),
                'button_label' => $str($p['button_label'] ?? null),
                'link' => self::cleanLink((array) $p['link']),
            ],
            'gallery' => [
                'title' => $str($p['title'] ?? null),
                'description' => $str($p['description'] ?? null),
                'items' => $items(fn (array $i) => ['media_id' => (int) $i['media_id'], 'label' => $str($i['label'] ?? null), 'link' => self::cleanLink((array) $i['link'])]),
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
            'food_hero' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'highlight' => $str($p['highlight'] ?? null),
                'subtitle' => $str($p['subtitle'] ?? null),
                'media_id' => $mediaOrNull($p['media_id'] ?? null),
                'stickers' => array_values(array_map(fn ($t) => (string) $str($t), (array) $p['stickers'])),
                'badge' => $str($p['badge'] ?? null),
                'primary_label' => (string) $str($p['primary_label']),
                'primary_link' => self::cleanLink((array) $p['primary_link']),
                'second_label' => $str($p['second_label'] ?? null),
                'second_link' => self::cleanLink((array) $p['second_link']),
                'trust' => array_values(array_map(fn (array $t) => ['icon' => (string) $t['icon'], 'text' => (string) $str($t['text'])], (array) $p['trust'])),
            ],
            'why' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'subtitle' => $str($p['subtitle'] ?? null),
                'media_id' => $mediaOrNull($p['media_id'] ?? null),
                'quote' => $str($p['quote'] ?? null),
                'items' => $this->cleanIconItems($p),
            ],
            'steps' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'items' => $this->cleanIconItems($p),
            ],
            'bundles' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'subtitle' => $str($p['subtitle'] ?? null),
                'cards' => array_values(array_map(fn (array $c) => [
                    'offer_id' => (int) $c['offer_id'],
                    'media_id' => $mediaOrNull($c['media_id'] ?? null),
                    'title' => (string) $str($c['title']),
                    'subtitle' => $str($c['subtitle'] ?? null),
                    'points' => array_values(array_map(fn ($t) => (string) $str($t), (array) $c['points'])),
                    'ribbon' => $str($c['ribbon'] ?? null),
                    'button_label' => $str($c['button_label'] ?? null),
                ], (array) $p['cards'])),
            ],
            'hours' => [
                'title' => $str($p['title'] ?? null),
                'subtitle' => $str($p['subtitle'] ?? null),
                'days' => array_values(array_map(fn (array $d) => ['open' => (bool) $d['open'], 'from' => (string) $d['from'], 'to' => (string) $d['to']], (array) $p['days'])),
                'open_message' => (string) $str($p['open_message']),
                'closed_message' => (string) $str($p['closed_message']),
            ],
            'glow_hero' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'highlight' => $str($p['highlight'] ?? null),
                'subtitle' => $str($p['subtitle'] ?? null),
                'media_id' => $mediaOrNull($p['media_id'] ?? null),
                'badge' => $str($p['badge'] ?? null),
                'rating' => $str($p['rating'] ?? null),
                'primary_label' => (string) $str($p['primary_label']),
                'primary_link' => self::cleanLink((array) $p['primary_link']),
                'second_label' => $str($p['second_label'] ?? null),
                'second_link' => self::cleanLink((array) $p['second_link']),
                'chips' => array_values(array_map(fn ($t) => (string) $str($t), (array) $p['chips'])),
            ],
            'shortcuts' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'description' => $str($p['description'] ?? null),
                'style' => (string) $p['style'],
                'items' => $items(fn (array $i) => [
                    'label' => (string) $str($i['label']),
                    'text' => $str($i['text'] ?? null),
                    'media_id' => $mediaOrNull($i['media_id'] ?? null),
                    'color' => isset($i['color']) && $i['color'] !== '' ? strtolower((string) $i['color']) : null,
                    'link' => self::cleanLink((array) $i['link']),
                ]),
            ],
            'routine' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'text' => $str($p['text'] ?? null),
                'button_label' => $str($p['button_label'] ?? null),
                'steps' => array_values(array_map(fn (array $x) => ['product_id' => (int) $x['product_id'], 'label' => $str($x['label'] ?? null), 'hint' => $str($x['hint'] ?? null)], (array) $p['steps'])),
            ],
            'reels' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'items' => $items(fn (array $i) => ['url' => trim((string) $i['url']), 'title' => $str($i['title'] ?? null), 'cover_media_id' => $mediaOrNull($i['cover_media_id'] ?? null)]),
            ],
            'ingredients' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'description' => $str($p['description'] ?? null),
                'items' => $items(fn (array $i) => [
                    'symbol' => (string) $str($i['symbol']),
                    'name' => (string) $str($i['name']),
                    'text' => $str($i['text'] ?? null),
                    'color' => isset($i['color']) && $i['color'] !== '' ? strtolower((string) $i['color']) : null,
                    'link' => self::cleanLink((array) $i['link']),
                ]),
            ],
            'before_after' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'text' => $str($p['text'] ?? null),
                'before_media_id' => (int) $p['before_media_id'],
                'after_media_id' => (int) $p['after_media_id'],
                'before_label' => (string) $str($p['before_label']),
                'after_label' => (string) $str($p['after_label']),
                'facts' => array_values(array_map(fn (array $x) => ['value' => (string) $str($x['value']), 'label' => (string) $str($x['label'])], (array) $p['facts'])),
            ],
            'skin_quiz' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => (string) $str($p['title']),
                'text' => $str($p['text'] ?? null),
                'button_label' => $str($p['button_label'] ?? null),
                'results' => array_values(array_map(fn (array $r) => [
                    'id' => (string) $r['id'],
                    'name' => (string) $str($r['name']),
                    'text' => $str($r['text'] ?? null),
                    'product_ids' => array_values(array_unique(array_map('intval', (array) ($r['product_ids'] ?? [])))),
                    'category_id' => isset($r['category_id']) && $r['category_id'] !== '' ? (int) $r['category_id'] : null,
                ], (array) $p['results'])),
                'questions' => array_values(array_map(fn (array $q) => [
                    'text' => (string) $str($q['text']),
                    'answers' => array_values(array_map(fn (array $a) => [
                        'text' => (string) $str($a['text']),
                        'results' => array_values(array_unique(array_map('strval', (array) $a['results']))),
                    ], (array) $q['answers'])),
                ], (array) $p['questions'])),
                'ai' => self::cleanQuizAi(is_array($p['ai'] ?? null) ? $p['ai'] : []),
            ],
            'articles' => [
                'kicker' => $str($p['kicker'] ?? null),
                'title' => $str($p['title'] ?? null),
                'items' => $items(fn (array $i) => [
                    'media_id' => $mediaOrNull($i['media_id'] ?? null),
                    'tag' => $str($i['tag'] ?? null),
                    'title' => (string) $str($i['title']),
                    // Line breaks kept: the reader shows paragraphs.
                    'body' => isset($i['body']) && trim(strip_tags((string) $i['body'])) !== '' ? trim(strip_tags((string) $i['body'])) : null,
                    'link' => self::cleanLink((array) $i['link']),
                ]),
            ],
            'cta' => [
                'title' => (string) $str($p['title']),
                'text' => $str($p['text'] ?? null),
                'button_label' => (string) $str($p['button_label']),
                'action' => (string) $p['action'],
                'message' => $str($p['message'] ?? null),
                'link' => self::cleanLink((array) $p['link']),
            ],
            default => throw new \LogicException("Unknown store section type «{$type}»."),
        };
    }

    /**
     * «اختبار البشرة»: 2–6 results (each with its products or a category), 2–6 questions of 2–5
     * answers, each answer counting for one or two of the results (by their id).
     *
     * @param  array<string, mixed>  $props
     * @return array<string, mixed>
     */
    private function quizRules(string $s, array $props): array
    {
        $text = self::text(...);
        $ids = array_values(array_filter(array_map(fn ($r) => is_array($r) ? ($r['id'] ?? null) : null, (array) ($props['results'] ?? [])), 'is_string'));
        $ai = is_array($props['ai'] ?? null) ? $props['ai'] : [];
        $aiOn = filter_var($ai['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $scope = $ai['scope'] ?? 'all';

        return [
            "{$s}.props.kicker" => $text(40),
            "{$s}.props.title" => $text(80, true),
            "{$s}.props.text" => $text(300),
            "{$s}.props.button_label" => $text(30),
            "{$s}.props.results" => ['required', 'array', 'min:2', 'max:6'],
            "{$s}.props.results.*.id" => ['required', 'string', 'regex:/^[a-z0-9]{1,12}$/', 'distinct'],
            "{$s}.props.results.*.name" => $text(40, true),
            "{$s}.props.results.*.text" => $text(300),
            "{$s}.props.results.*.product_ids" => ['present', 'array', 'max:4'],
            // No `distinct` here: across wildcards it would refuse one product in two results (repeats in one result are dropped in clean).
            "{$s}.props.results.*.product_ids.*" => ['integer', TenantExists::table('products')->ignoreTrashed()],
            "{$s}.props.results.*.category_id" => ['nullable', 'integer', TenantExists::table('categories')],
            "{$s}.props.questions" => ['required', 'array', 'min:2', 'max:6'],
            "{$s}.props.questions.*.text" => $text(120, true),
            "{$s}.props.questions.*.answers" => ['required', 'array', 'min:2', 'max:5'],
            "{$s}.props.questions.*.answers.*.text" => $text(60, true),
            "{$s}.props.questions.*.answers.*.results" => ['required', 'array', 'min:1', 'max:2'],
            "{$s}.props.questions.*.answers.*.results.*" => ['string', Rule::in($ids)],
            // The AI add-on (missing in quizzes saved before it: read as off).
            "{$s}.props.ai" => ['sometimes', 'array'],
            "{$s}.props.ai.enabled" => ['required_with:'."{$s}.props.ai", 'boolean'],
            "{$s}.props.ai.open_question" => ['required_with:'."{$s}.props.ai", 'boolean'],
            "{$s}.props.ai.open_label" => $text(60),
            "{$s}.props.ai.scope" => ['required_with:'."{$s}.props.ai", Rule::in(self::QUIZ_AI_SCOPES)],
            "{$s}.props.ai.category_ids" => ['present_with:'."{$s}.props.ai", 'array', 'max:20', ...$aiOn && $scope === 'categories' ? ['min:1'] : []],
            "{$s}.props.ai.category_ids.*" => ['integer', 'distinct', TenantExists::table('categories')],
            "{$s}.props.ai.product_ids" => ['present_with:'."{$s}.props.ai", 'array', 'max:50', ...$aiOn && $scope === 'products' ? ['min:2'] : []],
            "{$s}.props.ai.product_ids.*" => ['integer', 'distinct', TenantExists::table('products')->ignoreTrashed()],
        ];
    }

    /**
     * The quiz's AI add-on as stored (defaults for a quiz saved before it).
     *
     * @param  array<string, mixed>  $ai
     * @return array{enabled: bool, open_question: bool, open_label: string|null, scope: string, category_ids: list<int>, product_ids: list<int>}
     */
    public static function cleanQuizAi(array $ai): array
    {
        if ($ai === []) {
            return self::QUIZ_AI_DEFAULTS;
        }
        $label = trim((string) ($ai['open_label'] ?? ''));

        return [
            'enabled' => (bool) filter_var($ai['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'open_question' => (bool) filter_var($ai['open_question'] ?? true, FILTER_VALIDATE_BOOLEAN),
            'open_label' => $label === '' ? null : $label,
            'scope' => in_array($ai['scope'] ?? null, self::QUIZ_AI_SCOPES, true) ? (string) $ai['scope'] : 'all',
            'category_ids' => array_values(array_unique(array_map('intval', (array) ($ai['category_ids'] ?? [])))),
            'product_ids' => array_values(array_unique(array_map('intval', (array) ($ai['product_ids'] ?? [])))),
        ];
    }

    /** Rules of a list of {icon, title, text} items. @return array<string, mixed> */
    private function iconItems(string $s, int $min, int $max): array
    {
        return [
            "{$s}.props.items" => ['required', 'array', "min:{$min}", "max:{$max}"],
            "{$s}.props.items.*.icon" => ['required', Rule::in(self::FOOD_ICONS)],
            "{$s}.props.items.*.title" => self::text(40, true),
            "{$s}.props.items.*.text" => self::text(160),
        ];
    }

    /** @param array<string, mixed> $p @return list<array{icon: string, title: string, text: string|null}> */
    private function cleanIconItems(array $p): array
    {
        return array_values(array_map(fn (array $i) => ['icon' => (string) $i['icon'], 'title' => (string) self::str($i['title']), 'text' => self::str($i['text'] ?? null)], (array) $p['items']));
    }

    /** @param array<string, mixed> $props @return array<string, mixed> */
    private function slidesRules(string $s, array $props): array
    {
        $rules = [
            "{$s}.props.slides" => ['present', 'array', 'max:8'],
            "{$s}.props.autoplay" => ['required', 'boolean'],
        ];
        foreach (array_values((array) ($props['slides'] ?? [])) as $j => $slide) {
            $k = "{$s}.props.slides.{$j}";
            $rules += [
                "{$k}.media_id" => self::media(),
                "{$k}.title" => self::text(80),
                "{$k}.text" => self::text(200),
                "{$k}.button_label" => self::text(30),
                ...self::linkRules("{$k}.link", is_array($slide) ? (array) ($slide['link'] ?? []) : []),
            ];
        }

        return $rules;
    }

    /** @param array<string, mixed> $props @return array<string, mixed> */
    private function tabsRules(string $s, array $props): array
    {
        $text = self::text(...);
        $rules = [
            "{$s}.props.title" => $text(80),
            "{$s}.props.description" => $text(200),
            "{$s}.props.limit" => ['required', 'integer', Rule::in(self::PRODUCT_LIMITS)],
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
            $rules += $item($k) + self::linkRules("{$k}.link", is_array($row) ? (array) ($row['link'] ?? []) : []);
        }

        return $rules;
    }
}
