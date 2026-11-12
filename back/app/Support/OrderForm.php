<?php

declare(strict_types=1);

namespace App\Support;

use App\Services\PhoneNormalizer;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Builds the visitor's order validation from the published order_form settings (7.3.5)
 * and returns clean values. Mirrors front/src/themes/shared/order-form/fields.ts.
 */
final class OrderForm
{
    public const BUILT_IN = ['name', 'phone', 'phone2', 'email', 'governorate', 'city', 'address', 'notes'];

    public const LOCKED = ['name', 'phone'];

    /**
     * Built-in fields used when the section has no `fields` prop. The renderer merges props over
     * the schema defaults shallowly (site-renderer.tsx), so this must match order-form.ts defaults.
     */
    public const DEFAULT_FIELDS = [
        'name' => ['enabled' => true, 'required' => true],
        'phone' => ['enabled' => true, 'required' => true],
        'phone2' => ['enabled' => false, 'required' => false],
        'email' => ['enabled' => false, 'required' => false],
        'governorate' => ['enabled' => true, 'required' => true],
        'city' => ['enabled' => true, 'required' => false],
        'address' => ['enabled' => true, 'required' => true],
        'notes' => ['enabled' => true, 'required' => false],
    ];

    /** The store checkout: the default fields plus an optional email (order news and offers). */
    public const STORE_FIELDS = ['email' => ['enabled' => true, 'required' => false]] + self::DEFAULT_FIELDS;

    private const CUSTOM_TYPES = ['text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'date'];

    private const KEY_PATTERN = '/^[a-z][a-z0-9_]{0,59}$/';

    public function __construct(private readonly PhoneNormalizer $phones) {}

    /**
     * The offer the customer picked, honored only when the published form lets customers choose
     * (offer_picker); otherwise null = the automatic offer. 0 = no offer.
     *
     * @param  array<string, mixed>|null  $props  order_form props
     */
    public static function chosenOffer(?array $props, mixed $offerId): ?int
    {
        if (($props['offer_picker'] ?? false) !== true || $offerId === null || $offerId === '') {
            return null;
        }

        return max(0, (int) $offerId);
    }

    /**
     * Props of the first visible order_form section of a published content, or null.
     *
     * @param  array<string, mixed>|null  $content
     * @return array<string, mixed>|null
     */
    public static function section(?array $content): ?array
    {
        foreach ($content['sections'] ?? [] as $section) {
            if (is_array($section) && ($section['type'] ?? null) === 'order_form' && ($section['visible'] ?? true) === true) {
                return is_array($section['props'] ?? null) ? $section['props'] : [];
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $props  order_form props
     * @param  array<string, mixed>  $customer  raw customer input
     * @param  array<string, mixed>  $answers  raw custom answers
     * @return array{customer: array<string, string|null>, answers: list<array{key: string, label: string, type: string, value: mixed}>}
     *
     * @throws ValidationException keys customer.{key} / answers.{key}
     */
    public function validate(array $props, array $customer, array $answers): array
    {
        $fields = is_array($props['fields'] ?? null) ? $props['fields'] : self::DEFAULT_FIELDS;
        $rules = [];
        $attributes = [];
        $data = ['customer' => [], 'answers' => []];
        $errors = [];

        foreach (self::BUILT_IN as $key) {
            $config = is_array($fields[$key] ?? null) ? $fields[$key] : [];
            $locked = in_array($key, self::LOCKED, true);
            $enabled = $locked || ($config['enabled'] ?? false) === true;
            $value = $this->clean($customer[$key] ?? null);

            if (! $enabled) {
                if ($value !== null) {
                    $errors["customer.{$key}"] = [__('orders.field_not_allowed')];
                }

                continue;
            }

            $required = $locked || ($config['required'] ?? false) === true;
            $data['customer'][$key] = $value;
            $attributes["customer.{$key}"] = $this->label($config['label'] ?? null, __('orders.fields.'.$key));
            $rules["customer.{$key}"] = array_merge([$required ? 'required' : 'nullable', 'string'], match ($key) {
                'name' => ['min:2', 'max:80'],
                'phone', 'phone2' => ['max:30'],
                'email' => ['max:191', 'email:rfc'],
                'governorate' => [Rule::in(config('landing.governorates'))],
                'city' => ['max:100'],
                'address' => ['max:300'],
                'notes' => ['max:500'],
            });
        }

        $snapshot = [];
        foreach (is_array($props['custom_fields'] ?? null) ? $props['custom_fields'] : [] as $field) {
            if (! is_array($field) || ! is_string($field['key'] ?? null) || preg_match(self::KEY_PATTERN, $field['key']) !== 1) {
                continue;
            }
            $type = in_array($field['type'] ?? null, self::CUSTOM_TYPES, true) ? $field['type'] : 'text';
            $key = $field['key'];
            $required = ($field['required'] ?? false) === true;
            $label = $this->label($field['label'] ?? null, $key);
            $choices = array_values(array_filter(array_map(fn ($c) => is_string($c) ? trim($c) : '', is_array($field['choices'] ?? null) ? $field['choices'] : [])));
            $raw = $answers[$key] ?? null;

            $value = $type === 'checkbox' ? $this->bool($raw) : $this->clean($raw);
            $data['answers'][$key] = $value;
            $attributes["answers.{$key}"] = $label;
            $rules["answers.{$key}"] = match ($type) {
                'checkbox' => $required ? ['accepted'] : ['nullable', 'boolean'],
                'number' => [$required ? 'required' : 'nullable', 'numeric', 'between:-1000000000,1000000000'],
                'select', 'radio' => [$required ? 'required' : 'nullable', 'string', Rule::in($choices)],
                'date' => [$required ? 'required' : 'nullable', 'date_format:Y-m-d'],
                'textarea' => [$required ? 'required' : 'nullable', 'string', 'max:1000'],
                default => [$required ? 'required' : 'nullable', 'string', 'max:200'],
            };
            $snapshot[$key] = ['key' => $key, 'label' => $label, 'type' => $type];
        }

        $validator = Validator::make($data, $rules, [], $attributes);
        $validator->after(function ($validator) use ($data): void {
            foreach (['phone', 'phone2'] as $key) {
                $value = $data['customer'][$key] ?? null;
                if ($value !== null && ! $this->phones->isValid($value)) {
                    $validator->errors()->add("customer.{$key}", __('orders.invalid_phone'));
                }
            }
        });

        $failed = $validator->fails() ? $validator->errors()->toArray() : [];
        $errors = array_merge($failed, $errors);
        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $clean = $data['customer'];
        $clean['phone'] = $this->phones->normalize($clean['phone']);
        if (($clean['email'] ?? null) !== null) {
            $clean['email'] = mb_strtolower($clean['email']);
        }
        if (($clean['phone2'] ?? null) !== null) {
            $clean['phone2'] = $this->phones->normalize($clean['phone2']);
        }

        $answered = [];
        foreach ($snapshot as $key => $meta) {
            $value = $data['answers'][$key];
            if ($value === null || ($meta['type'] === 'checkbox' && $value === false && ! isset($answers[$key]))) {
                continue;
            }
            if ($meta['type'] === 'number') {
                $value = $value + 0;
            }
            $answered[] = $meta + ['value' => $value];
        }

        return ['customer' => $clean, 'answers' => $answered];
    }

    private function clean(mixed $value): ?string
    {
        if (is_int($value) || is_float($value)) {
            $value = (string) $value;
        }
        if (! is_string($value)) {
            return null;
        }
        $value = trim(strip_tags($value));

        return $value === '' ? null : $value;
    }

    private function bool(mixed $value): ?bool
    {
        return match (true) {
            $value === true, $value === 1, $value === '1', $value === 'true', $value === 'on' => true,
            $value === false, $value === 0, $value === '0', $value === 'false' => false,
            default => null,
        };
    }

    private function label(mixed $label, string $fallback): string
    {
        return is_string($label) && trim($label) !== '' ? mb_substr(trim($label), 0, 80) : $fallback;
    }
}
