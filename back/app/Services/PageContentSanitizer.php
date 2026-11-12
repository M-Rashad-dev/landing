<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\LandingPage;
use App\Models\Media;
use App\Rules\SafeUrl;
use Illuminate\Validation\ValidationException;

/**
 * Validates and cleans page content without knowing the front-end schemas,
 * using generic rules driven by key names (section 6):
 *  *_media_id / *_media_ids → media of the current tenant, *_url → SafeUrl,
 *  *_color → #RRGGBB, every string → HTML stripped and length-capped.
 *
 * Errors are reported as content.sections.{i}.props.{path}.
 */
final class PageContentSanitizer
{
    private const MAX_STRING = 5000;

    private const MAX_TITLE = 200;

    private const KEY_PATTERN = '/^[a-z][a-z0-9_]{0,59}$/';

    /** @var array<string, list<string>> */
    private array $errors = [];

    /** @var array<int, true> */
    private array $mediaIds = [];

    /** @var array<int, list<string>> where each media id appears (for error paths) */
    private array $mediaPaths = [];

    /**
     * @return array{content: array{version: int, sections: list<array<string, mixed>>, design?: array<string, mixed>}, media_ids: list<int>}
     *
     * @throws ValidationException
     */
    public function sanitize(mixed $content, string $root = 'content', string $kind = LandingPage::KIND_LANDING): array
    {
        $this->errors = [];
        $this->mediaIds = [];
        $this->mediaPaths = [];

        if (! is_array($content) || ! isset($content['sections']) || ! is_array($content['sections']) || ! array_is_list($content['sections'])) {
            throw ValidationException::withMessages([$root => [__('pages.content_invalid')]]);
        }

        $limits = config('landing.limits');
        $encoded = json_encode($content, JSON_UNESCAPED_UNICODE);
        if ($encoded === false || strlen($encoded) > (int) $limits['content_max_bytes']) {
            throw ValidationException::withMessages([$root => [__('pages.content_too_large')]]);
        }

        $sections = $content['sections'];
        if (count($sections) > (int) $limits['sections_per_page']) {
            throw ValidationException::withMessages(["{$root}.sections" => [__('pages.too_many_sections', ['max' => $limits['sections_per_page']])]]);
        }

        $types = config('landing.component_types');
        $maxPerType = config('landing.components.max_per_type');
        $counts = [];
        $ids = [];
        $clean = [];

        foreach ($sections as $index => $section) {
            $path = "{$root}.sections.{$index}";

            if (! is_array($section)) {
                $this->fail($path, __('pages.section_invalid'));

                continue;
            }

            $type = $section['type'] ?? null;
            if (! is_string($type) || ! in_array($type, $types, true)) {
                $this->fail("{$path}.type", __('pages.type_invalid'));

                continue;
            }

            $id = $section['id'] ?? null;
            if (! is_string($id) || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $id) !== 1) {
                $this->fail("{$path}.id", __('pages.id_invalid'));
            } elseif (isset($ids[strtolower($id)])) {
                $this->fail("{$path}.id", __('pages.id_duplicate'));
            } else {
                $ids[strtolower($id)] = true;
            }

            $variant = $section['variant'] ?? '';
            if (! is_string($variant) || preg_match('/^[a-z0-9-]{1,40}$/', $variant) !== 1) {
                $this->fail("{$path}.variant", __('pages.variant_invalid'));
            }

            $visible = $section['visible'] ?? true;
            if (! is_bool($visible)) {
                $this->fail("{$path}.visible", __('pages.visible_invalid'));
            }

            $counts[$type] = ($counts[$type] ?? 0) + 1;
            $max = $maxPerType[$type] ?? null;
            if ($max !== null && $counts[$type] > $max) {
                $this->fail("{$path}.type", __('pages.type_limit', ['max' => $max]));
            }

            $props = $section['props'] ?? [];
            if (! is_array($props) || ($props !== [] && array_is_list($props))) {
                $this->fail("{$path}.props", __('pages.props_invalid'));
                $props = [];
            }

            $clean[] = [
                'id' => is_string($id) ? strtolower($id) : '',
                'type' => $type,
                'variant' => is_string($variant) ? $variant : '',
                'visible' => is_bool($visible) ? $visible : true,
                'props' => $this->cleanObject($props, "{$path}.props", 1),
            ];
        }

        $design = array_key_exists('design', $content) && $content['design'] !== null ? $this->design($content['design'], "{$root}.design") : null;

        $this->checkMediaOwnership();

        if ($this->errors !== []) {
            throw ValidationException::withMessages($this->errors);
        }

        return [
            'content' => ['version' => 1, 'sections' => $clean] + ($design === null ? [] : ['design' => $design]),
            'media_ids' => array_map('intval', array_keys($this->mediaIds)),
        ];
    }

    /**
     * @param  array<string, mixed>  $object
     * @return array<string, mixed>
     */
    private function cleanObject(array $object, string $path, int $depth): array
    {
        if ($depth > (int) config('landing.limits.content_max_depth')) {
            $this->fail($path, __('pages.too_deep'));

            return [];
        }

        $clean = [];
        foreach ($object as $key => $value) {
            $key = (string) $key;
            if (preg_match(self::KEY_PATTERN, $key) !== 1) {
                $this->fail("{$path}.{$key}", __('pages.key_invalid'));

                continue;
            }

            $clean[$key] = $this->cleanValue($key, $value, "{$path}.{$key}", $depth);
        }

        return $clean;
    }

    private function cleanValue(string $key, mixed $value, string $path, int $depth): mixed
    {
        if ($value === null || is_bool($value)) {
            return $value;
        }

        if (str_ends_with($key, '_media_id')) {
            return $this->mediaId($value, $path);
        }

        if (str_ends_with($key, '_media_ids')) {
            if (! is_array($value) || ! array_is_list($value)) {
                $this->fail($path, __('pages.media_invalid'));

                return [];
            }

            return array_values(array_filter(array_map(fn ($id, $i) => $this->mediaId($id, "{$path}.{$i}"), $value, array_keys($value)), fn ($id) => $id !== null));
        }

        if (is_int($value) || is_float($value)) {
            return is_finite((float) $value) ? $value : 0;
        }

        if (is_string($value)) {
            return $this->cleanString($key, $value, $path);
        }

        if (is_array($value)) {
            if (count($value) > (int) config('landing.limits.content_max_array_items')) {
                $this->fail($path, __('pages.too_many_items', ['max' => config('landing.limits.content_max_array_items')]));

                return [];
            }

            if (array_is_list($value)) {
                $items = [];
                foreach ($value as $i => $item) {
                    $items[] = is_array($item)
                        ? ($item !== [] && array_is_list($item) ? $this->listTooDeep("{$path}.{$i}") : $this->cleanObject($item, "{$path}.{$i}", $depth + 1))
                        : $this->cleanValue($key, $item, "{$path}.{$i}", $depth + 1);
                }

                return $items;
            }

            return $this->cleanObject($value, $path, $depth + 1);
        }

        $this->fail($path, __('pages.value_invalid'));

        return null;
    }

    /** @return array<never, never> */
    private function listTooDeep(string $path): array
    {
        $this->fail($path, __('pages.too_deep'));

        return [];
    }

    private function cleanString(string $key, string $value, string $path): string
    {
        $value = trim(strip_tags($value));

        if (str_ends_with($key, '_url')) {
            if ($value !== '' && ! SafeUrl::isSafe($value)) {
                $this->fail($path, __('pages.unsafe_url'));

                return '';
            }

            return $value;
        }

        if (str_ends_with($key, '_color')) {
            if ($value !== '' && preg_match('/^#[0-9A-Fa-f]{6}$/', $value) !== 1) {
                $this->fail($path, __('pages.color_invalid'));

                return '';
            }

            return strtoupper($value);
        }

        $max = ($key === 'title' || str_ends_with($key, '_title') || $key === 'eyebrow') ? self::MAX_TITLE : self::MAX_STRING;

        return mb_substr($value, 0, $max);
    }

    private function mediaId(mixed $value, string $path): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (! is_int($value) && ! (is_string($value) && ctype_digit($value))) {
            $this->fail($path, __('pages.media_invalid'));

            return null;
        }

        $id = (int) $value;
        $this->mediaIds[$id] = true;
        $this->mediaPaths[$id][] = $path;

        return $id;
    }

    private function checkMediaOwnership(): void
    {
        if ($this->mediaIds === []) {
            return;
        }

        $owned = Media::query()->whereIn('id', array_keys($this->mediaIds))->pluck('id')->all();
        $missing = array_diff(array_keys($this->mediaIds), $owned);

        foreach ($missing as $id) {
            foreach ($this->mediaPaths[$id] ?? [] as $path) {
                $this->fail($path, __('pages.media_invalid'));
            }
            unset($this->mediaIds[$id]);
        }

        $this->mediaPaths = [];
    }

    /**
     * Page-only identity look (builder: "هوية خاصة بالصفحة"): colors, fonts and button radius
     * drawn over the page identity. Only known keys and values from the fixed lists pass.
     *
     * @return array{colors: array<string, string>, font_heading: string, font_body: string, button_radius: string}|null
     */
    private function design(mixed $design, string $path): ?array
    {
        if (! is_array($design) || array_is_list($design)) {
            $this->fail($path, __('pages.design_invalid'));

            return null;
        }

        $unknown = array_diff(array_keys($design), ['colors', 'font_heading', 'font_body', 'button_radius']);
        if ($unknown !== []) {
            $this->fail($path, __('pages.design_invalid'));
        }

        $colors = [];
        $allowed = array_keys((array) config('landing.default_colors'));
        $given = is_array($design['colors'] ?? null) ? $design['colors'] : [];
        foreach ($allowed as $key) {
            $value = $given[$key] ?? null;
            if ($value === null && $key === 'primary_foreground') {
                continue;
            }
            if (! is_string($value) || preg_match('/^#[0-9A-Fa-f]{6}$/', $value) !== 1) {
                $this->fail("{$path}.colors.{$key}", __('pages.design_color'));

                continue;
            }
            $colors[$key] = strtoupper($value);
        }
        if (array_diff(array_keys($given), $allowed) !== []) {
            $this->fail("{$path}.colors", __('pages.design_invalid'));
        }

        foreach (['font_heading', 'font_body'] as $key) {
            if (! in_array($design[$key] ?? null, (array) config('landing.fonts'), true)) {
                $this->fail("{$path}.{$key}", __('pages.design_font'));
            }
        }
        if (! in_array($design['button_radius'] ?? null, (array) config('landing.button_radii'), true)) {
            $this->fail("{$path}.button_radius", __('pages.design_invalid'));
        }

        return [
            'colors' => $colors,
            'font_heading' => (string) ($design['font_heading'] ?? ''),
            'font_body' => (string) ($design['font_body'] ?? ''),
            'button_radius' => (string) ($design['button_radius'] ?? ''),
        ];
    }

    private function fail(string $path, string $message): void
    {
        $this->errors[$path][] = $message;
    }
}
