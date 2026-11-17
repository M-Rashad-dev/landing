<?php

declare(strict_types=1);

namespace App\Themes\Landing;

use App\Support\OrderForm;
use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * The machinery every landing theme shares: a new section, the order form fields, the rule that
 * a page has exactly one order form (always shown), Arabic field names in the errors, and the
 * cleaners of the saved values. A theme only says its own settings and sections.
 */
trait LandingContent
{
    /** Order form fields the merchant can switch (name and phone are always asked). */
    public const FORM_FIELDS = ['phone2', 'email', 'governorate', 'city', 'address', 'notes'];

    /** @param array<string, mixed> $props @return array<string, mixed> */
    protected static function section(string $type, array $props): array
    {
        return ['id' => substr(bin2hex(random_bytes(6)), 0, 12), 'type' => $type, 'visible' => true, 'props' => $props];
    }

    /**
     * The order form fields in the shape App\Support\OrderForm reads (name and phone locked on).
     *
     * @param  array<string, mixed>  $given
     * @return array<string, array{enabled: bool, required: bool}>
     */
    protected static function fields(array $given): array
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

    /** @return array<string, list<string>> */
    protected static function fieldRules(string $prefix): array
    {
        $rules = [];
        foreach (self::FORM_FIELDS as $key) {
            $rules["{$prefix}.{$key}.enabled"] = ['required', 'boolean'];
            $rules["{$prefix}.{$key}.required"] = ['required', 'boolean'];
        }

        return $rules;
    }

    /**
     * Runs the theme's rules (with Arabic names from $names, by the last key of each field; list
     * items by their parent), checks the sections (unique ids, one shown order form) and returns
     * the theme's clean copy of what passed.
     *
     * @param  Closure(array<string, mixed>, string): array<string, mixed>  $rules
     * @param  array<string, string>  $names
     * @param  Closure(array<string, mixed>): array<string, mixed>  $clean
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    protected static function checked(mixed $content, string $prefix, Closure $rules, array $names, Closure $clean): array
    {
        $data = [$prefix => is_array($content) ? $content : []];
        $all = $rules($data[$prefix], $prefix);
        $attributes = [];
        foreach (array_keys($all) as $key) {
            $parts = explode('.', $key);
            $last = (string) end($parts);
            $name = $last === '*' ? (string) prev($parts) : $last;
            $name = $name === 'text' && str_contains($key, '.colors') ? 'text_color' : $name;
            if (isset($names[$name])) {
                $attributes[$key] = (string) $names[$name];
            }
        }

        $validator = Validator::make($data, $all, [], $attributes);
        $validator->after(function ($v) use ($data, $prefix): void {
            $seen = [];
            $forms = 0;
            foreach (array_values((array) ($data[$prefix]['sections'] ?? [])) as $i => $section) {
                $id = is_array($section) ? ($section['id'] ?? null) : null;
                if (is_string($id) && isset($seen[$id])) {
                    $v->errors()->add("{$prefix}.sections.{$i}.id", __('design.duplicate_section'));
                }
                $seen[(string) $id] = true;
                if (is_array($section) && ($section['type'] ?? null) === 'order_form') {
                    $forms++;
                    if (($section['visible'] ?? true) !== true) {
                        $v->errors()->add("{$prefix}.sections.{$i}.visible", __('themes/landing/bidaya.form_hidden'));
                    }
                }
            }
            // The page sells through its form: exactly one, always shown.
            if ($forms !== 1) {
                $v->errors()->add("{$prefix}.sections", __('themes/landing/bidaya.form_count'));
            }
        });
        $validator->validate();

        return $clean($validator->validated()[$prefix]);
    }

    /** A text without tags, or null when empty. */
    protected static function str(mixed $v): ?string
    {
        return is_string($v) && trim(strip_tags($v)) !== '' ? trim(strip_tags($v)) : null;
    }

    protected static function int(mixed $v): ?int
    {
        return $v === null || $v === '' ? null : (int) $v;
    }

    /** A date as ISO in UTC, or null. */
    protected static function date(mixed $v): ?string
    {
        return is_string($v) && $v !== '' ? Carbon::parse($v)->utc()->toIso8601ZuluString() : null;
    }

    /** @return list<string> the non-empty texts of a list */
    protected static function texts(mixed $v): array
    {
        return array_values(array_filter(array_map(fn ($x) => self::str($x), (array) $v), fn ($x) => $x !== null));
    }
}
