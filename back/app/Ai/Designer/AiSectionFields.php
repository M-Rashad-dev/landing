<?php

declare(strict_types=1);

namespace App\Ai\Designer;

use App\Rules\SafeUrl;
use App\Rules\TenantExists;
use App\Themes\Store\StoreSections;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Contracts\Validation\ValidatorAwareRule;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use Throwable;

/**
 * Schema cleaning, validation rules, and value normalization for AI section settings fields
 * (docs/plans/ai-designer.md §3.5).
 */
final class AiSectionFields
{
    public const MAX_FIELDS = 25;

    public const MAX_SUB_FIELDS = 8;

    public const TOP_TYPES = [
        'text',
        'textarea',
        'image',
        'images',
        'link',
        'color',
        'number',
        'toggle',
        'date',
        'products',
        'categories',
        'list',
    ];

    public const SUB_TYPES = [
        'text',
        'textarea',
        'image',
        'link',
        'color',
        'toggle',
        'number',
    ];

    public const COLOR_DEFAULTS = ['primary', 'secondary', 'text', 'background'];

    public const LANDING_LINK_TYPES = ['none', 'order', 'url'];

    private const RESERVED_KEYS = ['index', 'else', 'id', 'img', 'order_link', 'product'];

    /**
     * Clean and validate the AI's declared fields list.
     *
     * @param  array<int, mixed>  $fields
     * @return array{fields: list<array<string, mixed>>, errors: list<string>}
     */
    public static function schema(array $fields, string $kind): array
    {
        $errors = [];
        $cleaned = [];
        $seen = [];

        if (count($fields) > self::MAX_FIELDS) {
            $errors[] = 'A section cannot have more than 25 fields.';
        }

        foreach ($fields as $entry) {
            if (count($cleaned) >= self::MAX_FIELDS) {
                break;
            }
            if (! is_array($entry)) {
                continue;
            }

            $field = self::cleanFieldEntry($entry, $kind, false, $seen, $errors);
            if ($field !== null) {
                $seen[$field['key']] = true;
                $cleaned[] = $field;
            }
        }

        return [
            'fields' => $cleaned,
            'errors' => array_values(array_unique($errors)),
        ];
    }

    /**
     * Build Laravel validation rules for `{$prefix}.{key}` (e.g. `draft.sections.0.props.values`).
     *
     * @param  list<array<string, mixed>>  $fields
     * @return array<string, mixed>
     */
    public static function rules(array $fields, string $prefix, string $kind): array
    {
        $rules = [];

        foreach ($fields as $field) {
            if (! is_array($field) || ! isset($field['key'], $field['type'])) {
                continue;
            }
            $key = (string) $field['key'];
            $type = (string) $field['type'];
            $path = "{$prefix}.{$key}";

            $rules += self::fieldRules($field, $path, $prefix, $key, $type, $kind);
        }

        return $rules;
    }

    /**
     * Keep only known keys for the declared fields, properly typed.
     *
     * @param  list<array<string, mixed>>  $fields
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    public static function clean(array $fields, array $values, string $kind): array
    {
        $out = [];

        foreach ($fields as $field) {
            if (! is_array($field) || ! isset($field['key'], $field['type'])) {
                continue;
            }
            $key = (string) $field['key'];
            $type = (string) $field['type'];

            switch ($type) {
                case 'text':
                case 'textarea':
                    $defaultMax = $type === 'textarea' ? 600 : 120;
                    $max = (int) ($field['max'] ?? $defaultMax);
                    if (array_key_exists($key, $values) && is_string($values[$key])) {
                        $str = trim(strip_tags($values[$key]));
                        $out[$key] = mb_substr($str, 0, $max, 'UTF-8');
                    }
                    break;

                case 'image':
                    $mediaKey = "{$key}_media_id";
                    if (isset($values[$mediaKey]) && $values[$mediaKey] !== '') {
                        $out[$mediaKey] = (int) $values[$mediaKey];
                    }
                    break;

                case 'images':
                    $mediaKey = "{$key}_media_ids";
                    $max = (int) ($field['max'] ?? 8);
                    if (isset($values[$mediaKey]) && is_array($values[$mediaKey])) {
                        $ids = array_values(array_map('intval', array_slice($values[$mediaKey], 0, $max)));
                        $out[$mediaKey] = $ids;
                    }
                    break;

                case 'link':
                    if (isset($values[$key]) && is_array($values[$key]) && isset($values[$key]['type'])) {
                        $out[$key] = self::cleanLinkValue($values[$key], $kind);
                    }
                    break;

                case 'color':
                    if (isset($values[$key]) && is_string($values[$key]) && preg_match('/^#[0-9a-fA-F]{6}$/', $values[$key])) {
                        $out[$key] = strtolower($values[$key]);
                    }
                    break;

                case 'number':
                    if (isset($values[$key]) && $values[$key] !== '' && is_numeric($values[$key])) {
                        $min = (int) ($field['min'] ?? -100000);
                        $max = (int) ($field['max'] ?? 100000);
                        $out[$key] = max($min, min($max, (int) $values[$key]));
                    }
                    break;

                case 'toggle':
                    if (array_key_exists($key, $values) && $values[$key] !== null) {
                        $out[$key] = (bool) $values[$key];
                    }
                    break;

                case 'date':
                    if (isset($values[$key]) && is_string($values[$key]) && trim($values[$key]) !== '') {
                        try {
                            $out[$key] = Carbon::parse($values[$key])->utc()->toIso8601String();
                        } catch (Throwable) {
                            // Ignore unparseable dates
                        }
                    }
                    break;

                case 'products':
                    if ($kind === 'store' && isset($values[$key]) && is_array($values[$key]) && isset($values[$key]['source'])) {
                        $raw = $values[$key];
                        $source = in_array($raw['source'], StoreSections::TAB_SOURCES, true) ? (string) $raw['source'] : 'latest';
                        $limit = isset($raw['limit']) && in_array((int) $raw['limit'], StoreSections::PRODUCT_LIMITS, true)
                            ? (int) $raw['limit']
                            : 8;
                        $categoryId = ($source === 'category' && isset($raw['category_id']) && $raw['category_id'] !== '')
                            ? (int) $raw['category_id']
                            : null;
                        $productIds = ($source === 'manual' && isset($raw['product_ids']) && is_array($raw['product_ids']))
                            ? array_values(array_map('intval', array_slice($raw['product_ids'], 0, 24)))
                            : [];
                        $out[$key] = [
                            'source' => $source,
                            'category_id' => $categoryId,
                            'product_ids' => $productIds,
                            'limit' => $limit,
                        ];
                    }
                    break;

                case 'categories':
                    if ($kind === 'store' && isset($values[$key]) && is_array($values[$key])) {
                        $ids = isset($values[$key]['category_ids']) && is_array($values[$key]['category_ids'])
                            ? array_values(array_map('intval', array_slice($values[$key]['category_ids'], 0, 12)))
                            : [];
                        $out[$key] = ['category_ids' => $ids];
                    }
                    break;

                case 'list':
                    $max = (int) ($field['max'] ?? 6);
                    $subFields = is_array($field['fields'] ?? null) ? $field['fields'] : [];
                    if (isset($values[$key]) && is_array($values[$key])) {
                        $items = [];
                        foreach (array_slice(array_values($values[$key]), 0, $max) as $item) {
                            if (is_array($item)) {
                                $items[] = self::clean($subFields, $item, $kind);
                            }
                        }
                        $out[$key] = $items;
                    }
                    break;
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @param  array<string, bool>  $seen
     * @param  list<string>  $errors
     * @return array<string, mixed>|null
     */
    private static function cleanFieldEntry(
        array $entry,
        string $kind,
        bool $isSubField,
        array $seen,
        array &$errors,
    ): ?array {
        $key = isset($entry['key']) && is_string($entry['key']) ? trim($entry['key']) : '';
        if (
            ! preg_match('/^[a-z][a-z0-9_]{1,30}$/', $key)
            || str_ends_with($key, '_media_id')
            || str_ends_with($key, '_media_ids')
            || in_array($key, self::RESERVED_KEYS, true)
            || isset($seen[$key])
        ) {
            return null;
        }

        $type = isset($entry['type']) && is_string($entry['type']) ? trim($entry['type']) : '';
        $allowedTypes = $isSubField ? self::SUB_TYPES : self::TOP_TYPES;
        if (! in_array($type, $allowedTypes, true)) {
            return null;
        }

        if ($kind === 'landing' && in_array($type, ['products', 'categories'], true)) {
            $errors[] = "Field '{$key}' of type '{$type}' is not allowed on landing pages.";

            return null;
        }

        $label = isset($entry['label']) && is_string($entry['label'])
            ? mb_substr(trim(strip_tags($entry['label'])), 0, 60, 'UTF-8')
            : '';
        if ($label === '') {
            return null;
        }

        $out = [
            'key' => $key,
            'type' => $type,
            'label' => $label,
        ];

        if (isset($entry['hint']) && is_string($entry['hint'])) {
            $hint = mb_substr(trim(strip_tags($entry['hint'])), 0, 160, 'UTF-8');
            if ($hint !== '') {
                $out['hint'] = $hint;
            }
        }

        switch ($type) {
            case 'text':
                $max = isset($entry['max']) && is_numeric($entry['max'])
                    ? max(1, min(300, (int) $entry['max']))
                    : 120;
                $sample = isset($entry['sample']) && is_string($entry['sample'])
                    ? mb_substr(trim(strip_tags($entry['sample'])), 0, $max, 'UTF-8')
                    : $label;
                $out['max'] = $max;
                $out['sample'] = $sample;
                break;

            case 'textarea':
                $max = isset($entry['max']) && is_numeric($entry['max'])
                    ? max(1, min(3000, (int) $entry['max']))
                    : 600;
                $sample = isset($entry['sample']) && is_string($entry['sample'])
                    ? mb_substr(trim(strip_tags($entry['sample'])), 0, $max, 'UTF-8')
                    : $label;
                $out['max'] = $max;
                $out['sample'] = $sample;
                break;

            case 'image':
                $out['sample'] = null;
                break;

            case 'images':
                $max = isset($entry['max']) && is_numeric($entry['max'])
                    ? max(1, min(12, (int) $entry['max']))
                    : 8;
                $sample = isset($entry['sample']) && is_numeric($entry['sample'])
                    ? max(1, min($max, (int) $entry['sample']))
                    : min(4, $max);
                $out['max'] = $max;
                $out['sample'] = $sample;
                break;

            case 'link':
                $out['sample'] = null;
                break;

            case 'color':
                $def = isset($entry['default']) && is_string($entry['default']) && in_array($entry['default'], self::COLOR_DEFAULTS, true)
                    ? $entry['default']
                    : 'primary';
                $out['default'] = $def;
                $out['sample'] = null;
                break;

            case 'number':
                $min = isset($entry['min']) && is_numeric($entry['min'])
                    ? max(-100000, min(100000, (int) $entry['min']))
                    : 0;
                $max = isset($entry['max']) && is_numeric($entry['max'])
                    ? max($min, min(100000, (int) $entry['max']))
                    : max($min, 1000);
                $sample = isset($entry['sample']) && is_numeric($entry['sample'])
                    ? max($min, min($max, (int) $entry['sample']))
                    : $min;
                $out['min'] = $min;
                $out['max'] = $max;
                $out['sample'] = $sample;
                break;

            case 'toggle':
                $out['sample'] = isset($entry['sample']) ? (bool) $entry['sample'] : true;
                break;

            case 'date':
                $out['sample'] = null;
                break;

            case 'products':
                $sample = isset($entry['sample']) && is_numeric($entry['sample'])
                    ? max(3, min(12, (int) $entry['sample']))
                    : 4;
                $out['sample'] = $sample;
                break;

            case 'categories':
                $sample = isset($entry['sample']) && is_numeric($entry['sample'])
                    ? max(3, min(8, (int) $entry['sample']))
                    : 4;
                $out['sample'] = $sample;
                break;

            case 'list':
                $max = isset($entry['max']) && is_numeric($entry['max'])
                    ? max(1, min(12, (int) $entry['max']))
                    : 6;
                $rawSubs = isset($entry['fields']) && is_array($entry['fields']) ? $entry['fields'] : [];
                $subFields = [];
                $seenSubs = [];
                foreach ($rawSubs as $rawSub) {
                    if (count($subFields) >= self::MAX_SUB_FIELDS) {
                        break;
                    }
                    if (! is_array($rawSub)) {
                        continue;
                    }
                    $sub = self::cleanFieldEntry($rawSub, $kind, true, $seenSubs, $errors);
                    if ($sub !== null) {
                        $seenSubs[$sub['key']] = true;
                        $subFields[] = $sub;
                    }
                }
                if ($subFields === []) {
                    return null;
                }
                $out['max'] = $max;
                $out['fields'] = $subFields;
                $out['sample'] = self::cleanListSample($entry['sample'] ?? [], $subFields, $max);
                break;
        }

        return $out;
    }

    /**
     * @param  list<array<string, mixed>>  $subFields
     * @return list<array<string, mixed>>
     */
    private static function cleanListSample(mixed $rawSample, array $subFields, int $max): array
    {
        if (! is_array($rawSample)) {
            return [];
        }

        $items = [];
        foreach (array_slice(array_values($rawSample), 0, $max) as $rawItem) {
            if (! is_array($rawItem)) {
                continue;
            }
            $item = [];
            foreach ($subFields as $sub) {
                $k = (string) $sub['key'];
                $t = (string) $sub['type'];
                if ($t === 'text' || $t === 'textarea') {
                    $subMax = (int) ($sub['max'] ?? ($t === 'textarea' ? 600 : 120));
                    $val = isset($rawItem[$k]) && is_string($rawItem[$k])
                        ? mb_substr(trim(strip_tags($rawItem[$k])), 0, $subMax, 'UTF-8')
                        : (string) ($sub['sample'] ?? $sub['label']);
                    $item[$k] = $val;
                } elseif ($t === 'number') {
                    $min = (int) ($sub['min'] ?? 0);
                    $maxNum = (int) ($sub['max'] ?? 1000);
                    $val = isset($rawItem[$k]) && is_numeric($rawItem[$k])
                        ? max($min, min($maxNum, (int) $rawItem[$k]))
                        : (int) ($sub['sample'] ?? $min);
                    $item[$k] = $val;
                } elseif ($t === 'toggle') {
                    $item[$k] = isset($rawItem[$k]) ? (bool) $rawItem[$k] : (bool) ($sub['sample'] ?? true);
                } elseif ($t === 'color') {
                    $item[$k] = isset($rawItem[$k]) && is_string($rawItem[$k]) && preg_match('/^#[0-9a-fA-F]{6}$/', $rawItem[$k])
                        ? strtolower($rawItem[$k])
                        : null;
                }
            }
            $items[] = $item;
        }

        return $items;
    }

    /**
     * @param  array<string, mixed>  $field
     * @return array<string, mixed>
     */
    private static function fieldRules(
        array $field,
        string $path,
        string $prefix,
        string $key,
        string $type,
        string $kind,
    ): array {
        return match ($type) {
            'text' => [
                $path => ['nullable', 'string', 'max:'.((int) ($field['max'] ?? 120))],
            ],
            'textarea' => [
                $path => ['nullable', 'string', 'max:'.((int) ($field['max'] ?? 600))],
            ],
            'image' => [
                "{$prefix}.{$key}_media_id" => ['nullable', 'integer', TenantExists::table('media')],
            ],
            'images' => [
                "{$prefix}.{$key}_media_ids" => ['nullable', 'array', 'max:'.((int) ($field['max'] ?? 8))],
                "{$prefix}.{$key}_media_ids.*" => ['integer', TenantExists::table('media')],
            ],
            'link' => self::linkFieldRules($path, $kind),
            'color' => [
                $path => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            ],
            'number' => [
                $path => [
                    'nullable',
                    'integer',
                    'between:'.((int) ($field['min'] ?? -100000)).','.((int) ($field['max'] ?? 100000)),
                ],
            ],
            'toggle' => [
                $path => ['nullable', 'boolean'],
            ],
            'date' => [
                $path => ['nullable', 'date'],
            ],
            'products' => $kind === 'store' ? self::productsFieldRules($path) : [],
            'categories' => $kind === 'store' ? [
                $path => ['nullable', 'array'],
                "{$path}.category_ids" => ['nullable', 'array', 'max:12'],
                "{$path}.category_ids.*" => ['integer', 'distinct', TenantExists::table('categories')],
            ] : [],
            'list' => self::listFieldRules($field, $path, $kind),
            default => [],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private static function linkFieldRules(string $path, string $kind): array
    {
        if ($kind === 'landing') {
            return [
                $path => ['nullable', 'array', self::conditionalLinkRule('landing')],
                "{$path}.type" => ['required_with:'.$path, Rule::in(self::LANDING_LINK_TYPES)],
                "{$path}.url" => ['nullable', 'string', 'max:500', new SafeUrl],
            ];
        }

        return [
            $path => ['nullable', 'array', self::conditionalLinkRule('store')],
            "{$path}.type" => ['required_with:'.$path, Rule::in(StoreSections::LINK_TYPES)],
            "{$path}.target_id" => ['nullable', 'integer'],
            "{$path}.url" => ['nullable', 'string', 'max:500', new SafeUrl],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function productsFieldRules(string $path): array
    {
        return [
            $path => ['nullable', 'array', self::conditionalProductsRule()],
            "{$path}.source" => ['required_with:'.$path, Rule::in(StoreSections::TAB_SOURCES)],
            "{$path}.limit" => ['nullable', 'integer', Rule::in(StoreSections::PRODUCT_LIMITS)],
            "{$path}.category_id" => ['nullable', 'integer', TenantExists::table('categories')],
            "{$path}.product_ids" => ['nullable', 'array', 'max:24'],
            "{$path}.product_ids.*" => ['integer', 'distinct', TenantExists::table('products')->ignoreTrashed()],
        ];
    }

    /**
     * @param  array<string, mixed>  $field
     * @return array<string, mixed>
     */
    private static function listFieldRules(array $field, string $path, string $kind): array
    {
        $max = (int) ($field['max'] ?? 6);
        $rules = [
            $path => ['nullable', 'array', 'max:'.$max],
        ];

        $subFields = is_array($field['fields'] ?? null) ? $field['fields'] : [];
        $itemPrefix = "{$path}.*";

        foreach ($subFields as $sub) {
            if (! is_array($sub) || ! isset($sub['key'], $sub['type'])) {
                continue;
            }
            $subKey = (string) $sub['key'];
            $subType = (string) $sub['type'];
            $subPath = "{$itemPrefix}.{$subKey}";

            $rules += self::fieldRules($sub, $subPath, $itemPrefix, $subKey, $subType, $kind);
        }

        return $rules;
    }

    private static function conditionalLinkRule(string $kind): ValidatorAwareRule
    {
        return new class($kind) implements ValidationRule, ValidatorAwareRule
        {
            private Validator $validator;

            public function __construct(private readonly string $kind) {}

            public function setValidator(Validator $validator): static
            {
                $this->validator = $validator;

                return $this;
            }

            public function validate(string $attribute, mixed $value, Closure $fail): void
            {
                if (! is_array($value)) {
                    return;
                }

                $type = $value['type'] ?? null;

                if ($type === 'url') {
                    $url = $value['url'] ?? null;
                    if (! is_string($url) || trim($url) === '') {
                        $this->validator->errors()->add("{$attribute}.url", __('validation.required', ['attribute' => 'url']));
                    }

                    return;
                }

                if ($this->kind === 'store' && in_array($type, ['category', 'product'], true)) {
                    $targetId = $value['target_id'] ?? null;
                    if (! is_int($targetId) && (! is_string($targetId) || ! ctype_digit($targetId))) {
                        $this->validator->errors()->add("{$attribute}.target_id", __('validation.required', ['attribute' => 'target_id']));

                        return;
                    }

                    $rule = $type === 'category'
                        ? TenantExists::table('categories')
                        : TenantExists::table('products')->ignoreTrashed();

                    $rule->validate("{$attribute}.target_id", (int) $targetId, function (string $msg) use ($attribute): void {
                        $this->validator->errors()->add("{$attribute}.target_id", $msg);
                    });
                }
            }
        };
    }

    private static function conditionalProductsRule(): ValidatorAwareRule
    {
        return new class implements ValidationRule, ValidatorAwareRule
        {
            private Validator $validator;

            public function setValidator(Validator $validator): static
            {
                $this->validator = $validator;

                return $this;
            }

            public function validate(string $attribute, mixed $value, Closure $fail): void
            {
                if (! is_array($value)) {
                    return;
                }

                $source = $value['source'] ?? null;

                if ($source === 'category') {
                    $catId = $value['category_id'] ?? null;
                    if ($catId === null || $catId === '') {
                        $this->validator->errors()->add("{$attribute}.category_id", __('validation.required', ['attribute' => 'category_id']));
                    }
                } elseif ($source === 'manual') {
                    $ids = $value['product_ids'] ?? null;
                    if (! is_array($ids) || count($ids) < 1) {
                        $this->validator->errors()->add("{$attribute}.product_ids", __('validation.required', ['attribute' => 'product_ids']));
                    }
                }
            }
        };
    }

    /**
     * @param  array<string, mixed>  $link
     * @return array<string, mixed>
     */
    private static function cleanLinkValue(array $link, string $kind): array
    {
        if ($kind === 'landing') {
            $type = in_array($link['type'] ?? null, self::LANDING_LINK_TYPES, true) ? (string) $link['type'] : 'none';

            return [
                'type' => $type,
                'url' => $type === 'url' && isset($link['url']) ? trim((string) $link['url']) : null,
            ];
        }

        return StoreSections::cleanLink([
            'type' => (string) ($link['type'] ?? 'none'),
            'target_id' => $link['target_id'] ?? null,
            'url' => $link['url'] ?? null,
        ]);
    }
}
